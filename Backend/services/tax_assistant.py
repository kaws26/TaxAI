from __future__ import annotations

from typing import Any

import pandas as pd

from services.document_ingestion import DocumentValidationError, ParsedDocument, parse_document
from services.tax_constants import DEFAULT_FINANCIAL_YEAR, SUPPORTED_DOCUMENTS
from services.tax_engine import build_business_working, build_tax_computation


def _empty_frame(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame(columns=columns)


def _build_missing_data_checklist(profile_type: str, document_types: set[str]) -> list[str]:
    checklist: list[str] = []

    if "ais" not in document_types:
        checklist.append("AIS/26AS CSV is missing. TDS and tax-credit reconciliation may be incomplete.")
    if profile_type == "individual" and "form16" not in document_types:
        checklist.append("Form 16 CSV is missing. Salary and employer TDS computation may be incomplete.")
    if "bank_statement" not in document_types:
        checklist.append("Bank statement CSV is missing. Interest and transaction-based analysis may be incomplete.")
    if profile_type == "small_business" and not {"sales_register", "purchase_register"} & document_types:
        checklist.append("Sales or purchase register CSV is missing. Business GST and P&L will rely mostly on bank heuristics.")

    return checklist


def analyze_tax_documents(
    profile_type: str,
    regime: str,
    financial_year: str | None,
    documents: list[dict[str, str]],
    tax_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if profile_type not in {"individual", "small_business"}:
        raise ValueError("profile_type must be 'individual' or 'small_business'.")
    if not documents:
        raise ValueError("At least one document must be provided.")

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

    if errors and not parsed_documents:
        return {
            "status": "error",
            "message": "None of the uploaded documents could be parsed.",
            "errors": errors,
        }

    bank_frames = [item.normalized for item in parsed_documents if item.document_type == "bank_statement"]
    register_frames = [
        item.normalized
        for item in parsed_documents
        if item.document_type in {"sales_register", "purchase_register"}
    ]
    ais_frames = [item.normalized for item in parsed_documents if item.document_type == "ais"]
    form16_entries = [item.normalized for item in parsed_documents if item.document_type == "form16"]

    combined_working = build_business_working(bank_frames + register_frames)
    bank_transactions = combined_working["transactions"]
    business_working = (
        build_business_working(register_frames or bank_frames)
        if profile_type == "small_business" or register_frames
        else {
            "profit_and_loss": {"revenue": 0.0, "expenses": 0.0, "net_profit": 0.0, "net_margin_pct": 0.0},
            "balance_sheet": {"assets": {}, "liabilities": {}, "equity": {}},
            "gst_summary": None,
            "ledger": [],
            "insights": [],
        }
    )
    ais_entries = pd.concat(ais_frames, ignore_index=True) if ais_frames else _empty_frame(["income_type", "amount", "tds", "tcs"])

    if regime == "auto":
        old_result = build_tax_computation(
            profile_type=profile_type,
            regime="old",
            financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
            bank_transactions=bank_transactions,
            ais_entries=ais_entries,
            form16_summaries=form16_entries,
            business_working=business_working,
            tax_profile=tax_profile,
        )
        new_result = build_tax_computation(
            profile_type=profile_type,
            regime="new",
            financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
            bank_transactions=bank_transactions,
            ais_entries=ais_entries,
            form16_summaries=form16_entries,
            business_working=business_working,
            tax_profile=tax_profile,
        )
        selected_regime = (
            "old"
            if old_result["tax_computation"]["total_tax_liability"] < new_result["tax_computation"]["total_tax_liability"]
            else "new"
        )
        tax_result = new_result if selected_regime == "new" else old_result
        tax_result["regime_recommendation"] = {
            "selected_regime": selected_regime,
            "old_regime_tax": old_result["tax_computation"]["total_tax_liability"],
            "new_regime_tax": new_result["tax_computation"]["total_tax_liability"],
        }
    else:
        tax_result = build_tax_computation(
            profile_type=profile_type,
            regime=regime,
            financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
            bank_transactions=bank_transactions,
            ais_entries=ais_entries,
            form16_summaries=form16_entries,
            business_working=business_working,
            tax_profile=tax_profile,
        )

    parsed_types = {item.document_type for item in parsed_documents}
    return {
        "status": "success",
        "profile_type": profile_type,
        "financial_year": financial_year or DEFAULT_FINANCIAL_YEAR,
        "supported_documents": SUPPORTED_DOCUMENTS,
        "documents_processed": [
            {
                "document_type": item.document_type,
                "source_name": item.source_name,
                "summary": item.summary,
            }
            for item in parsed_documents
        ],
        "parse_errors": errors,
        "missing_data_checklist": _build_missing_data_checklist(profile_type, parsed_types),
        "tax_result": tax_result,
        "business_result": {
            "profit_and_loss": business_working["profit_and_loss"],
            "balance_sheet": business_working["balance_sheet"],
            "gst_summary": business_working["gst_summary"],
            "ledger_preview": business_working["ledger"][:20],
            "insights": business_working["insights"],
        },
    }


def answer_tax_question(analysis: dict[str, Any], question: str) -> dict[str, Any]:
    normalized_question = question.strip().lower()
    tax_result = analysis.get("tax_result", {})
    business_result = analysis.get("business_result", {})

    if not normalized_question:
        return {"answer": "Ask about tax payable, refund, GST, missing documents, or suggested ITR form."}

    if "refund" in normalized_question:
        refund_due = tax_result.get("net_result", {}).get("refund_due", 0.0)
        return {"answer": f"Estimated refund based on the uploaded documents is Rs {refund_due:.2f}."}

    if "payable" in normalized_question or "tax due" in normalized_question:
        payable = tax_result.get("net_result", {}).get("balance_tax_payable", 0.0)
        return {"answer": f"Estimated balance tax payable is Rs {payable:.2f} before any manual adjustments."}

    if "itr" in normalized_question or "form" in normalized_question:
        itr_form = tax_result.get("filing_position", {}).get("suggested_itr_form", "manual review needed")
        return {"answer": f"The current recommendation is {itr_form}."}

    if "gst" in normalized_question:
        gst_summary = business_result.get("gst_summary") or {}
        net_gst = gst_summary.get("net_gst_payable", 0.0)
        return {"answer": f"Estimated net GST payable from the current business records is Rs {net_gst:.2f}."}

    if "missing" in normalized_question or "document" in normalized_question:
        missing = analysis.get("missing_data_checklist", [])
        if not missing:
            return {"answer": "No critical missing-document warnings were detected from the current upload set."}
        return {"answer": "Key gaps detected: " + " ".join(missing)}

    if "deduction" in normalized_question:
        deductions = tax_result.get("deductions", {})
        return {
            "answer": (
                f"Standard deduction considered is Rs {deductions.get('standard_deduction', 0.0):.2f}. "
                f"Additional deductions considered: {deductions.get('chapter_vi_a', {})}."
            )
        }

    return {
        "answer": (
            "The current analysis can answer questions about tax payable, refund, GST, ITR form, deductions, "
            "and missing documents. For deeper legal interpretation, a CA review is still recommended."
        )
    }
