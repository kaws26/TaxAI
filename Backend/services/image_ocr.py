from __future__ import annotations

import os
import tempfile
import uuid
from io import BytesIO
from typing import Any

from PIL import Image, ImageOps

from runtime import get_runtime_config
from services.document_ingestion import DocumentValidationError, parse_document
from services.groq_ai import extract_csv_from_ocr_text, groq_status
from services.tax_constants import SUPPORTED_DOCUMENTS

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".tiff", ".tif", ".bmp"}

class OcrConversionError(ValueError):
    pass

_processor = None
_model = None

def _load_glm_ocr():
    global _processor, _model
    if _processor is None or _model is None:
        from transformers import AutoProcessor, AutoModelForImageTextToText
        import torch
        MODEL_PATH = "zai-org/GLM-OCR"
        _processor = AutoProcessor.from_pretrained(MODEL_PATH)
        _model = AutoModelForImageTextToText.from_pretrained(
            pretrained_model_name_or_path=MODEL_PATH,
            torch_dtype="auto",
            device_map="auto",
        )

def ocr_status() -> dict[str, Any]:
    return {
        "glm_ocr_configured": True,
        "groq": groq_status(),
    }

def _is_image_filename(filename: str) -> bool:
    return os.path.splitext(filename.lower())[1] in IMAGE_EXTENSIONS

def _extract_text_from_image(image_bytes: bytes) -> str:
    try:
        _load_glm_ocr()
    except Exception as exc:
        raise OcrConversionError(f"Failed to load GLM-OCR model. Make sure transformers and torch are installed. Error: {exc}")

    temp_filename = f"{uuid.uuid4().hex}.png"
    try:
        image = Image.open(BytesIO(image_bytes))
        image.save(temp_filename, format="PNG")
    except Exception as exc:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise OcrConversionError(f"Uploaded file is not a readable image: {exc}") from exc

    try:
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "url": temp_filename
                    },
                    {
                        "type": "text",
                        "text": "Text Recognition:"
                    }
                ],
            }
        ]
        
        inputs = _processor.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt"
        ).to(_model.device)
        
        inputs.pop("token_type_ids", None)
        generated_ids = _model.generate(**inputs, max_new_tokens=8192)
        output_text = _processor.decode(generated_ids[0][inputs["input_ids"].shape[1]:], skip_special_tokens=False)
        
        normalized = "\n".join(line.rstrip() for line in output_text.splitlines())
        if len(normalized.strip()) < 20:
            raise OcrConversionError(
                "OCR extracted too little text from the image. Upload a clearer image or use CSV."
            )
        return normalized
    except Exception as exc:
        raise OcrConversionError(f"OCR Inference failed: {exc}") from exc
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


def convert_image_to_csv_document(
    *,
    document_type: str,
    source_name: str,
    image_bytes: bytes,
) -> dict[str, Any]:
    if document_type not in SUPPORTED_DOCUMENTS:
        raise OcrConversionError(f"Unsupported document type: {document_type}")
    if not _is_image_filename(source_name):
        raise OcrConversionError(f"{source_name} is not a supported image format.")

    ocr_text = _extract_text_from_image(image_bytes)
    schema = SUPPORTED_DOCUMENTS[document_type]
    llm_result = extract_csv_from_ocr_text(
        document_type=document_type,
        required_any_of=schema.get("required_any_of", []),
        optional=schema.get("optional", []),
        ocr_text=ocr_text,
    )

    if not llm_result or not llm_result.get("meta", {}).get("success"):
        meta = (llm_result or {}).get("meta", {})
        detail = str(meta.get("detail", "")).strip()
        error_code = str(meta.get("error", "")).strip()
        suffix_parts = [part for part in [error_code, detail] if part]
        suffix = f" Details: {' | '.join(suffix_parts)}" if suffix_parts else ""
        raise OcrConversionError(
            "Unable to convert OCR text into structured CSV. Ensure Groq is enabled and GROQ_API_KEY is valid."
            f"{suffix}"
        )

    csv_content = str(llm_result.get("csv_content", "")).strip()
    if not csv_content:
        raise OcrConversionError("Structured extraction returned empty CSV content.")

    csv_source_name = f"{os.path.splitext(source_name)[0]}.csv"
    try:
        parse_document(document_type, csv_content, csv_source_name)
    except DocumentValidationError as exc:
        raise OcrConversionError(
            "OCR conversion produced CSV that failed schema checks: "
            f"{exc}. Upload a clearer image or provide CSV directly."
        ) from exc

    return {
        "document_type": document_type,
        "source_name": csv_source_name,
        "csv_content": csv_content,
        "storage_kind": "ocr_image_upload",
        "metadata": {
            "source": "OCR",
            "conversion_meta": {
                "origin": "image_ocr",
                "original_source": source_name,
                "ocr_chars": len(ocr_text),
                "llm_meta": llm_result.get("meta", {}),
            },
        },
    }
