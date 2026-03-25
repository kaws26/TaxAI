from __future__ import annotations

from typing import Any

import pandas as pd

from extensions import db
from models import TaxDocumentUpload, TaxFilingJob
from services.ai_extraction import build_canonical_tax_model
from services.canonical_tax_model import summarize_confidence
from services.document_catalog import parse_uploaded_documents
from services.itr_mapper import map_to_itr_draft
from services.optimization import recommend_tax_optimizations
from services.portal_adapter import portal_adapter_capabilities
from services.reconciliation import reconcile_canonical_data
from services.review_workflow import build_review_state, next_status_for_processed_job
from services.tax_assistant import _build_missing_data_checklist
from services.tax_constants import DEFAULT_FINANCIAL_YEAR, SUPPORTED_DOCUMENTS
from services.tax_engine import build_business_working
from services.tax_rules import compute_tax_by_financial_year

JOB_STATUSES = {
    "uploaded",
    "parsed",
    "normalized",
    "reconciled",
    "computed",
    "needs_review",
    "approved",
    "exported",
    "efile_ready",
}


def create_filing_job(
    *,
    user_id: int,
    profile_type: str,
    regime_preference: str,
    financial_year: str,
    taxpayer_profile: dict[str, Any] | None = None,
    tax_profile: dict[str, Any] | None = None,
) -> TaxFilingJob:
    job = TaxFilingJob(
        user_id=user_id,
        profile_type=profile_type,
        regime_preference=regime_preference,
        financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
        status="uploaded",
        taxpayer_profile=taxpayer_profile or {},
        tax_profile=tax_profile or {},
    )
    db.session.add(job)
    db.session.commit()
    return job


def attach_documents_to_job(job: TaxFilingJob, documents: list[dict[str, str]]) -> list[TaxDocumentUpload]:
    uploads: list[TaxDocumentUpload] = []
    for document in documents:
        upload = TaxDocumentUpload(
            job_id=job.id,
            document_type=str(document["document_type"]).strip(),
            source_name=str(document.get("source_name") or "uploaded.csv"),
            raw_content=document["csv_content"],
            parse_status="uploaded",
        )
        db.session.add(upload)
        uploads.append(upload)

    if uploads:
        job.status = "uploaded"
        db.session.commit()
    return uploads


def _job_documents_payload(job: TaxFilingJob) -> list[dict[str, str]]:
    return [
        {
            "document_type": document.document_type,
            "source_name": document.source_name,
            "csv_content": document.raw_content,
        }
        for document in job.documents
    ]


def _empty_frame(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame(columns=columns)


def _collect_frames(parsed_documents):
    bank_frames = [item.normalized for item in parsed_documents if item.document_type == "bank_statement"]
    register_frames = [
        item.normalized
        for item in parsed_documents
        if item.document_type in {"sales_register", "purchase_register"}
    ]
    ais_frames = [item.normalized for item in parsed_documents if item.document_type == "ais"]
    form16_entries = [item.normalized for item in parsed_documents if item.document_type == "form16"]
    return bank_frames, register_frames, ais_frames, form16_entries


def _special_document_adjustments(
    parsed_documents,
    ais_entries: pd.DataFrame,
    form16_entries: list[dict[str, Any]],
    tax_profile: dict[str, Any],
) -> tuple[pd.DataFrame, list[dict[str, Any]], dict[str, Any]]:
    adjusted_profile = dict(tax_profile or {})
    ais_adjustments: list[dict[str, Any]] = []

    for document in parsed_documents:
        if document.document_type == "interest_certificate":
            ais_adjustments.append(
                {
                    "income_type": "interest",
                    "amount": float(document.normalized.get("interest_income", 0.0)),
                    "tds": float(document.normalized.get("tds", 0.0)),
                    "tcs": 0.0,
                }
            )
        elif document.document_type == "rent_summary":
            ais_adjustments.append(
                {
                    "income_type": "rent",
                    "amount": float(document.normalized.get("annual_rent_received", 0.0)),
                    "tds": 0.0,
                    "tcs": 0.0,
                }
            )
        elif document.document_type == "capital_gains_statement":
            ais_adjustments.append(
                {
                    "income_type": "capital_gains",
                    "amount": float(document.normalized.get("net_gain", 0.0)),
                    "tds": 0.0,
                    "tcs": 0.0,
                }
            )
        elif document.document_type == "deduction_proof":
            deductions = adjusted_profile.setdefault("deductions", {})
            for key, value in document.normalized.get("deductions", {}).items():
                deductions[str(key).strip().lower()] = round(float(value or 0.0), 2)

    if ais_adjustments:
        ais_entries = pd.concat([ais_entries, pd.DataFrame(ais_adjustments)], ignore_index=True)
    return ais_entries, form16_entries, adjusted_profile


def process_filing_job(job: TaxFilingJob) -> dict[str, Any]:
    documents = _job_documents_payload(job)
    parsed_documents, parse_errors = parse_uploaded_documents(documents)

    for upload in job.documents:
        upload.parse_status = "parsed" if not any(
            error["source_name"] == upload.source_name and error["document_type"] == upload.document_type
            for error in parse_errors
        ) else "error"

    if not parsed_documents:
        result = {
            "status": "error",
            "message": "None of the uploaded documents could be parsed.",
            "parse_errors": parse_errors,
            "supported_documents": SUPPORTED_DOCUMENTS,
        }
        job.status = "uploaded"
        job.processing_result = result
        db.session.commit()
        return result

    job.status = "parsed"
    bank_frames, register_frames, ais_frames, form16_entries = _collect_frames(parsed_documents)
    combined_working = build_business_working(bank_frames + register_frames)
    bank_transactions = combined_working["transactions"]
    business_working = (
        build_business_working(register_frames or bank_frames)
        if job.profile_type == "small_business" or register_frames
        else {
            "profit_and_loss": {"revenue": 0.0, "expenses": 0.0, "net_profit": 0.0, "net_margin_pct": 0.0},
            "balance_sheet": {"assets": {}, "liabilities": {}, "equity": {}},
            "gst_summary": None,
            "ledger": [],
            "insights": [],
        }
    )
    ais_entries = pd.concat(ais_frames, ignore_index=True) if ais_frames else _empty_frame(["income_type", "amount", "tds", "tcs"])
    ais_entries, form16_entries, adjusted_tax_profile = _special_document_adjustments(
        parsed_documents,
        ais_entries,
        form16_entries,
        job.tax_profile or {},
    )

    filing_context = {
        "job_id": job.job_id,
        "profile_type": job.profile_type,
        "financial_year": job.financial_year,
        "regime_preference": job.regime_preference,
    }
    canonical_model = build_canonical_tax_model(
        taxpayer_profile=job.taxpayer_profile or {},
        filing_context=filing_context,
        parsed_documents=parsed_documents,
        tax_profile=adjusted_tax_profile,
    )
    job.status = "normalized"

    reconciliation = reconcile_canonical_data(canonical_model)
    job.status = "reconciled"

    old_result = compute_tax_by_financial_year(
        profile_type=job.profile_type,
        regime="old",
        financial_year=job.financial_year,
        bank_transactions=bank_transactions,
        ais_entries=ais_entries,
        form16_summaries=form16_entries,
        business_working=business_working,
        tax_profile=adjusted_tax_profile,
    )
    new_result = compute_tax_by_financial_year(
        profile_type=job.profile_type,
        regime="new",
        financial_year=job.financial_year,
        bank_transactions=bank_transactions,
        ais_entries=ais_entries,
        form16_summaries=form16_entries,
        business_working=business_working,
        tax_profile=adjusted_tax_profile,
    )

    selected_regime = job.regime_preference if job.regime_preference in {"old", "new"} else None
    if selected_regime is None:
        selected_regime = (
            "old"
            if old_result["tax_computation"]["total_tax_liability"] < new_result["tax_computation"]["total_tax_liability"]
            else "new"
        )
    selected_result = old_result if selected_regime == "old" else new_result
    selected_result["regime_recommendation"] = {
        "selected_regime": selected_regime,
        "old_regime_tax": old_result["tax_computation"]["total_tax_liability"],
        "new_regime_tax": new_result["tax_computation"]["total_tax_liability"],
    }

    optimization = recommend_tax_optimizations(
        old_regime_result=old_result,
        new_regime_result=new_result,
        canonical_data=canonical_model.to_dict(),
    )
    draft_return = map_to_itr_draft(
        job_id=job.job_id,
        profile_type=job.profile_type,
        canonical_data=canonical_model.to_dict(),
        tax_result=selected_result,
        reconciliation=reconciliation,
    )
    review_state = build_review_state(reconciliation=reconciliation, tax_result=selected_result)
    confidence_summary = {
        "income_facts": summarize_confidence(canonical_model.incomes),
        "deduction_facts": summarize_confidence(canonical_model.deductions),
        "tax_credit_facts": summarize_confidence(canonical_model.tax_credits),
    }
    evidence_links = [
        {
            "document_type": document.document_type,
            "source_name": document.source_name,
            "summary": document.summary,
        }
        for document in parsed_documents
    ]
    groq_audit_entries = [
        entry
        for entry in canonical_model.ai_audit_trail
        if str(entry.get("engine", "")).startswith("groq_")
    ]
    successful_groq_entries = [entry for entry in groq_audit_entries if entry.get("success") is True]

    result = {
        "status": "success",
        "job": {},
        "documents_processed": [
            {
                "document_type": document.document_type,
                "source_name": document.source_name,
                "summary": document.summary,
            }
            for document in parsed_documents
        ],
        "parse_errors": parse_errors,
        "supported_documents": SUPPORTED_DOCUMENTS,
        "canonical_data": canonical_model.to_dict(),
        "reconciliation_issues": reconciliation["issues"],
        "optimization_recommendations": optimization["recommendations"],
        "review_blockers": review_state["review_blockers"],
        "confidence_summary": confidence_summary,
        "evidence_links": evidence_links,
        "ai_workflow": {
            "provider": "groq" if successful_groq_entries else "heuristic_only",
            "mode": "batched_document_classification",
            "groq_attempts": len({entry.get("source_name") for entry in groq_audit_entries}),
            "groq_calls_used": len({(entry.get("source_name"), entry.get("model")) for entry in successful_groq_entries}),
            "fallback_enabled": True,
            "audit_entries": canonical_model.ai_audit_trail,
        },
        "draft_return": draft_return,
        "tax_result": selected_result,
        "business_result": {
            "profit_and_loss": business_working["profit_and_loss"],
            "balance_sheet": business_working["balance_sheet"],
            "gst_summary": business_working["gst_summary"],
            "ledger_preview": business_working["ledger"][:20],
            "insights": business_working["insights"],
        },
        "review_state": review_state,
        "missing_data_checklist": _build_missing_data_checklist(
            job.profile_type,
            {document.document_type for document in parsed_documents},
        ),
        "portal_adapter": portal_adapter_capabilities(),
    }

    job.status = next_status_for_processed_job(review_state)
    result["job"] = job.to_dict()
    job.processing_result = result
    db.session.commit()
    return result


def approve_filing_job(job: TaxFilingJob, approval_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    result = job.processing_result or {}
    if not result:
        raise ValueError("Job must be processed before approval.")

    review_state = result.get("review_state", {})
    if review_state.get("review_blockers"):
        raise ValueError("Job has unresolved review blockers and cannot be approved yet.")

    job.status = "approved"
    job.approved_payload = approval_payload or {"approved": True}
    db.session.commit()
    return {
        "status": "success",
        "job": job.to_dict(),
        "approval": job.approved_payload,
    }
