from __future__ import annotations

import os
import tempfile
from typing import Any

from huggingface_hub import InferenceClient

from runtime import get_runtime_config
from services.document_ingestion import DocumentValidationError, parse_document
from services.groq_ai import extract_csv_from_ocr_text, groq_status
from services.tax_constants import SUPPORTED_DOCUMENTS


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".tiff", ".tif", ".bmp"}


class OcrConversionError(ValueError):
    pass


def ocr_status() -> dict[str, Any]:
    config = get_runtime_config()
    hf_token = str(getattr(config, "HF_TOKEN", "")).strip()
    return {
        "provider": getattr(config, "HF_OCR_PROVIDER", "zai-org"),
        "model": getattr(config, "HF_OCR_MODEL", "zai-org/GLM-OCR"),
        "has_hf_token": bool(hf_token),
        "groq": groq_status(),
    }


def _is_image_filename(filename: str) -> bool:
    return os.path.splitext(filename.lower())[1] in IMAGE_EXTENSIONS


def _extract_text_from_image(image_bytes: bytes, source_name: str) -> str:
    config = get_runtime_config()
    hf_token = str(getattr(config, "HF_TOKEN", "")).strip()
    if not hf_token:
        raise OcrConversionError("HF_TOKEN is not configured. Set HF_TOKEN to use Hugging Face OCR.")

    client = InferenceClient(
        provider=str(getattr(config, "HF_OCR_PROVIDER", "zai-org")).strip() or "zai-org",
        api_key=hf_token,
    )

    suffix = os.path.splitext(source_name)[1].lower() or ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(image_bytes)
        temp_path = temp_file.name

    try:
        output = client.image_to_text(
            temp_path,
            model=str(getattr(config, "HF_OCR_MODEL", "zai-org/GLM-OCR")).strip() or "zai-org/GLM-OCR",
        )
        normalized = "\n".join(line.rstrip() for line in str(output or "").splitlines())
        if len(normalized.strip()) < 20:
            raise OcrConversionError(
                "OCR extracted too little text from the image. Upload a clearer image or use CSV."
            )
        return normalized
    except OcrConversionError:
        raise
    except Exception as exc:
        raise OcrConversionError(f"Hugging Face OCR inference failed: {exc}") from exc
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def convert_image_to_csv_document(
    *,
    document_type: str,
    source_name: str,
    image_bytes: bytes,
) -> dict[str, Any]:
    config = get_runtime_config()
    if document_type not in SUPPORTED_DOCUMENTS:
        raise OcrConversionError(f"Unsupported document type: {document_type}")
    if not _is_image_filename(source_name):
        raise OcrConversionError(f"{source_name} is not a supported image format.")

    ocr_text = _extract_text_from_image(image_bytes, source_name)
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
                "origin": "huggingface_glm_ocr",
                "provider": getattr(config, "HF_OCR_PROVIDER", "zai-org"),
                "model": getattr(config, "HF_OCR_MODEL", "zai-org/GLM-OCR"),
                "original_source": source_name,
                "ocr_chars": len(ocr_text),
                "llm_meta": llm_result.get("meta", {}),
            },
        },
    }
