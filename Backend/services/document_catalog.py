from __future__ import annotations

from typing import Any

from services.document_ingestion import DocumentValidationError, ParsedDocument, parse_document
from services.tax_constants import SUPPORTED_DOCUMENTS


def list_supported_documents() -> dict[str, dict[str, Any]]:
    return SUPPORTED_DOCUMENTS


def parse_uploaded_documents(documents: list[dict[str, str]]) -> tuple[list[ParsedDocument], list[dict[str, str]]]:
    parsed_documents: list[ParsedDocument] = []
    errors: list[dict[str, str]] = []

    for index, document in enumerate(documents, start=1):
        document_type = str(document.get("document_type", "")).strip()
        source_name = str(document.get("source_name") or f"document_{index}.csv")
        csv_content = document.get("csv_content", "")
        try:
            parsed_documents.append(parse_document(document_type, csv_content, source_name))
        except DocumentValidationError as exc:
            errors.append(
                {
                    "source_name": source_name,
                    "document_type": document_type,
                    "message": str(exc),
                }
            )

    return parsed_documents, errors
