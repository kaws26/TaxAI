from __future__ import annotations

import re
from typing import Any

import pandas as pd

from extensions import db
from models import TaxDocumentUpload, TaxFilingJob, TransactionRecord
from services.document_ingestion import DocumentValidationError, ParsedDocument, parse_document
from services.groq_ai import enrich_transaction_rows


TRANSACTION_DOCUMENT_TYPES = {"bank_statement", "sales_register", "purchase_register"}

DISPLAY_CATEGORY_MAP = {
    "sales": "Income",
    "professional_receipts": "Income",
    "interest": "Income",
    "salary": "Income",
    "rent": "Income",
    "dividend": "Income",
    "capital_gains": "Income",
    "food": "Food & Dining",
    "travel": "Transportation",
    "transportation": "Transportation",
    "shopping": "Shopping",
    "purchase": "Shopping",
    "utilities": "Utilities",
    "office_expense": "Office Expense",
    "software": "Software",
    "loan": "Loan",
    "tax_payment": "Tax Payment",
    "marketing": "Marketing",
    "transfer": "Transfer",
    "other": "Other",
}


def supports_transaction_extraction(document_type: str) -> bool:
    return str(document_type).strip() in TRANSACTION_DOCUMENT_TYPES


def _display_source(storage_kind: str, metadata: dict[str, Any] | None = None) -> str:
    metadata = metadata or {}
    if str(metadata.get("source", "")).strip():
        return str(metadata["source"]).strip()
    normalized = str(storage_kind or "").strip().lower()
    if "ocr" in normalized or "image" in normalized:
        return "OCR"
    if "manual" in normalized:
        return "Manual"
    return "CSV"


def _fallback_merchant(description: str) -> str:
    text = re.sub(r"\s+", " ", str(description or "").strip())
    text = re.sub(r"^(neft|upi|imps|rtgs|ach|card|cash|dr|cr)\s+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^[A-Z]{2,8}-\d{2}-\d{4,6}\s+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(invoice|receipt|payment|expense|credit|debit|trip|settlement)\b.*$", "", text, flags=re.IGNORECASE)
    cleaned = text.strip(" -:/")
    return cleaned[:255] or "Unknown Merchant"


def _display_category(raw_category: str, txn_type: str) -> str:
    normalized = str(raw_category or "").strip().lower().replace("&", "and").replace(" ", "_")
    if txn_type == "income" and normalized in {"sales", "professional_receipts", "interest", "salary", "rent", "dividend", "capital_gains"}:
        return "Income"
    return DISPLAY_CATEGORY_MAP.get(normalized, "Income" if txn_type == "income" else "Other")


def _rows_from_parsed_document(parsed_document: ParsedDocument) -> list[dict[str, Any]]:
    normalized = parsed_document.normalized
    if not isinstance(normalized, pd.DataFrame) or normalized.empty:
        return []

    rows: list[dict[str, Any]] = []
    for index, row in normalized.reset_index(drop=True).iterrows():
        date_text = str(row.get("date", "")).strip()
        if not date_text:
            continue
        description = str(row.get("description", "")).strip()
        txn_type = str(row.get("txn_type", "expense")).strip().lower() or "expense"
        amount = round(float(row.get("amount", 0.0) or 0.0), 2)
        raw_category = str(row.get("category", "")).strip()
        rows.append(
            {
                "row_id": f"{parsed_document.document_type}:{index}",
                "date": date_text,
                "description": description,
                "amount": amount,
                "txn_type": txn_type,
                "raw_category": raw_category,
                "merchant": _fallback_merchant(description),
                "category": _display_category(raw_category, txn_type),
            }
        )
    return rows


def _apply_groq_enrichment(document_type: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if document_type != "bank_statement" or not rows:
        return rows

    enriched = enrich_transaction_rows(rows) or {}
    items_by_id = {
        str(item.get("row_id", "")): item
        for item in enriched.get("items", [])
        if isinstance(item, dict) and str(item.get("row_id", "")).strip()
    }
    for row in rows:
        item = items_by_id.get(row["row_id"])
        if not item:
            continue
        merchant = str(item.get("merchant", "")).strip()
        category = str(item.get("category", "")).strip()
        confidence = float(item.get("confidence", 0.0) or 0.0)
        if merchant:
            row["merchant"] = merchant[:255]
        if category:
            row["category"] = _display_category(category, row["txn_type"])
            row["raw_category"] = category
        row["confidence"] = round(confidence, 3)
    return rows


def sync_transactions_for_upload(
    *,
    job: TaxFilingJob,
    upload: TaxDocumentUpload,
    csv_content: str,
) -> dict[str, Any]:
    if not supports_transaction_extraction(upload.document_type):
        return {"supported": False, "inserted": 0}

    try:
        parsed_document = parse_document(upload.document_type, csv_content, upload.source_name)
    except DocumentValidationError as exc:
        return {"supported": True, "inserted": 0, "error": str(exc)}

    rows = _rows_from_parsed_document(parsed_document)
    rows = _apply_groq_enrichment(upload.document_type, rows)

    db.session.query(TransactionRecord).filter_by(document_upload_id=upload.id).delete()
    source_label = _display_source(upload.storage_kind, upload.metadata_json or {})
    inserted = 0
    for row in rows:
        db.session.add(
            TransactionRecord(
                job_id=job.id,
                document_upload_id=upload.id,
                transaction_date=str(row["date"])[:10],
                merchant=str(row.get("merchant", "")).strip()[:255] or "Unknown Merchant",
                description=str(row.get("description", "")).strip(),
                amount=round(float(row.get("amount", 0.0) or 0.0), 2),
                txn_type=str(row.get("txn_type", "expense")).strip().lower() or "expense",
                category=_display_category(str(row.get("raw_category") or row.get("category") or ""), str(row.get("txn_type", "expense"))),
                source=source_label,
                document_type=upload.document_type,
                source_name=upload.source_name,
                confidence=round(float(row.get("confidence", 0.0) or 0.0), 3),
                metadata_json={
                    "raw_category": str(row.get("raw_category", "")).strip(),
                    "row_id": row.get("row_id"),
                },
            )
        )
        inserted += 1

    return {"supported": True, "inserted": inserted}


def summarize_transactions_for_job(job_id: int, limit: int = 10) -> dict[str, Any]:
    records = (
        TransactionRecord.query.filter_by(job_id=job_id)
        .order_by(TransactionRecord.transaction_date.desc(), TransactionRecord.id.desc())
        .all()
    )
    category_totals: dict[str, dict[str, Any]] = {}
    for record in records:
        bucket = category_totals.setdefault(
            record.category,
            {"category": record.category, "count": 0, "income": 0.0, "expense": 0.0, "net_amount": 0.0},
        )
        bucket["count"] += 1
        amount = round(float(record.amount or 0.0), 2)
        if record.txn_type == "income":
            bucket["income"] = round(bucket["income"] + amount, 2)
            bucket["net_amount"] = round(bucket["net_amount"] + amount, 2)
        else:
            bucket["expense"] = round(bucket["expense"] + amount, 2)
            bucket["net_amount"] = round(bucket["net_amount"] - amount, 2)

    condensed = sorted(
        category_totals.values(),
        key=lambda item: (item["count"], abs(item["net_amount"])),
        reverse=True,
    )
    return {
        "total_transactions": len(records),
        "categories": condensed,
        "recent_transactions": [record.to_dict() for record in records[:limit]],
    }
