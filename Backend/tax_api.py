from __future__ import annotations

import json
import os
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from extensions import db
from models import TaxFilingJob
from runtime import get_runtime_config
from security import get_current_user_id
from services.groq_ai import groq_status
from services.image_ocr import IMAGE_EXTENSIONS, OcrConversionError, convert_image_to_csv_document
from services.pdf_export import save_itr_pdf
from services.portal_adapter import portal_adapter_capabilities
from services.tax_assistant import analyze_tax_documents, answer_tax_question
from services.tax_constants import DEFAULT_FINANCIAL_YEAR, SUPPORTED_DOCUMENTS
from services.tax_jobs import (
    JOB_STATUSES,
    approve_filing_job,
    attach_documents_to_job,
    create_filing_job,
    process_filing_job,
)


tax_bp = APIRouter(prefix="/api/tax-assistant")


def _error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse({"message": message}, status_code=status_code)


@tax_bp.get("/options")
def options():
    return {
        "profile_types": ["individual", "small_business"],
        "regimes": ["old", "new", "auto"],
        "default_financial_year": DEFAULT_FINANCIAL_YEAR,
        "supported_documents": SUPPORTED_DOCUMENTS,
        "job_statuses": sorted(JOB_STATUSES),
        "portal_adapter": portal_adapter_capabilities(),
        "ai_provider": groq_status(),
    }


def _get_job_or_404(job_id: str, current_user_id: int) -> TaxFilingJob | None:
    job = TaxFilingJob.query.filter_by(job_id=job_id, user_id=current_user_id).first()
    if job is None:
        return None
    return job


def _safe_amount(value: Any) -> float:
    try:
        return round(float(value or 0.0), 2)
    except (TypeError, ValueError):
        return 0.0


def _build_monthly_overview(result: dict[str, Any]) -> list[dict[str, Any]]:
    ledger_preview = result.get("business_result", {}).get("ledger_preview", [])
    monthly_rollup: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})

    for entry in ledger_preview:
        if not isinstance(entry, dict):
            continue
        date_text = str(entry.get("date", "")).strip()
        if len(date_text) < 7:
            continue
        month_key = date_text[:7]
        amount = _safe_amount(entry.get("amount"))
        debit_account = str(entry.get("debit_account", "")).strip().lower()
        credit_account = str(entry.get("credit_account", "")).strip().lower()
        if debit_account == "cash/bank":
            monthly_rollup[month_key]["income"] += amount
        elif credit_account == "cash/bank":
            monthly_rollup[month_key]["expense"] += amount

    return [
        {
            "month": month,
            "income": round(values["income"], 2),
            "expense": round(values["expense"], 2),
        }
        for month, values in sorted(monthly_rollup.items())
    ]


def _build_expense_split(result: dict[str, Any]) -> list[dict[str, Any]]:
    ledger_preview = result.get("business_result", {}).get("ledger_preview", [])
    totals: dict[str, float] = defaultdict(float)

    for entry in ledger_preview:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("credit_account", "")).strip().lower() != "cash/bank":
            continue
        category = str(entry.get("category", "")).strip().replace("_", " ").title() or "Other"
        totals[category] += _safe_amount(entry.get("amount"))

    grand_total = round(sum(totals.values()), 2)
    if grand_total <= 0:
        return []

    return [
        {
            "category": category,
            "amount": round(amount, 2),
            "percentage": round((amount / grand_total) * 100, 2),
        }
        for category, amount in sorted(totals.items(), key=lambda item: item[1], reverse=True)
    ]


def _build_income_split(result: dict[str, Any]) -> list[dict[str, Any]]:
    income_breakdown = result.get("tax_result", {}).get("income_breakdown", {})
    series: list[dict[str, Any]] = []

    for key, value in income_breakdown.items():
        if key == "special_rate_income":
            if isinstance(value, dict):
                for special_key, special_value in value.items():
                    amount = _safe_amount(special_value)
                    if amount > 0:
                        series.append(
                            {
                                "category": str(special_key).replace("_", " ").title(),
                                "amount": amount,
                            }
                        )
            continue

        amount = _safe_amount(value)
        if amount > 0:
            series.append(
                {
                    "category": str(key).replace("_", " ").title(),
                    "amount": amount,
                }
            )

    total_income = round(sum(item["amount"] for item in series), 2)
    if total_income <= 0:
        return []

    return [
        {
            **item,
            "percentage": round((item["amount"] / total_income) * 100, 2),
        }
        for item in sorted(series, key=lambda entry: entry["amount"], reverse=True)
    ]


def _build_dashboard_payload(job: TaxFilingJob) -> dict[str, Any]:
    result = dict(job.processing_result or {})
    tax_result = result.get("tax_result", {})
    tax_computation = tax_result.get("tax_computation", {})
    net_result = tax_result.get("net_result", {})
    regime_recommendation = tax_result.get("regime_recommendation", {})
    profit_and_loss = result.get("business_result", {}).get("profit_and_loss", {})

    estimated_savings = abs(
        _safe_amount(regime_recommendation.get("old_regime_tax"))
        - _safe_amount(regime_recommendation.get("new_regime_tax"))
    )

    optimization_recommendations = result.get("optimization_recommendations", [])
    insights = result.get("business_result", {}).get("insights", [])
    income_split = _build_income_split(result)
    expense_split = _build_expense_split(result)
    monthly_overview = _build_monthly_overview(result)
    total_income = _safe_amount(tax_result.get("gross_total_income"))
    total_expenses = _safe_amount(profit_and_loss.get("expenses"))

    return {
        "status": "success",
        "job": {
            "job_id": job.job_id,
            "financial_year": job.financial_year,
            "status": job.status,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        },
        "summary": {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "total_credits": total_income,
            "total_debits": total_expenses,
            "net_cashflow": round(total_income - total_expenses, 2),
            "gross_total_income": total_income,
            "total_deductions": _safe_amount(tax_result.get("deductions", {}).get("total_deductions")),
            "taxable_income": _safe_amount(tax_result.get("taxable_income")),
            "total_tax_liability": _safe_amount(tax_computation.get("total_tax_liability")),
            "refund_due": _safe_amount(net_result.get("refund_due")),
            "balance_tax_payable": _safe_amount(net_result.get("balance_tax_payable")),
            "estimated_savings": round(estimated_savings, 2),
            "regime": tax_result.get("regime"),
            "suggested_itr_form": tax_result.get("filing_position", {}).get("suggested_itr_form"),
        },
        "charts": {
            "income_split": income_split,
            "expense_split": expense_split,
            "monthly_cashflow": monthly_overview,
        },
        "insights": [
            str(item.get("message", "")).strip()
            for item in [*optimization_recommendations, *insights]
            if isinstance(item, dict) and str(item.get("message", "")).strip()
        ],
        "highlights": {
            "assistant_summary": str(tax_result.get("assistant_summary", "")).strip(),
            "compliance_flags": tax_result.get("compliance_flags", []),
            "missing_data_count": len(result.get("missing_data_checklist", [])),
        },
    }


def _empty_dashboard_payload() -> dict[str, Any]:
    return {
        "status": "success",
        "job": None,
        "summary": {
            "total_income": 0.0,
            "total_expenses": 0.0,
            "total_credits": 0.0,
            "total_debits": 0.0,
            "net_cashflow": 0.0,
            "gross_total_income": 0.0,
            "total_deductions": 0.0,
            "taxable_income": 0.0,
            "total_tax_liability": 0.0,
            "refund_due": 0.0,
            "balance_tax_payable": 0.0,
            "estimated_savings": 0.0,
            "regime": None,
            "suggested_itr_form": None,
        },
        "charts": {
            "income_split": [],
            "expense_split": [],
            "monthly_cashflow": [],
        },
        "insights": [],
        "highlights": {
            "assistant_summary": "",
            "compliance_flags": [],
            "missing_data_count": 0,
        },
    }


async def _convert_uploaded_file(document_type: str, file_storage: UploadFile) -> dict[str, str]:
    filename = str(file_storage.filename or "uploaded").strip()
    if not filename:
        raise ValueError("Uploaded file must have a filename.")

    lower_name = filename.lower()
    content = await file_storage.read()

    if lower_name.endswith(".csv"):
        try:
            csv_content = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError(f"{filename} is not UTF-8 encoded CSV.") from exc
        return {
            "document_type": document_type,
            "source_name": filename,
            "csv_content": csv_content,
        }

    if any(lower_name.endswith(ext) for ext in IMAGE_EXTENSIONS):
        try:
            return convert_image_to_csv_document(
                document_type=document_type,
                source_name=filename,
                image_bytes=content,
            )
        except OcrConversionError as exc:
            raise ValueError(f"{filename}: {exc}") from exc

    allowed_images = ", ".join(sorted(IMAGE_EXTENSIONS))
    raise ValueError(
        f"{filename} is not supported. Upload CSV or image files ({allowed_images})."
    )


async def _json_payload(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return payload if isinstance(payload, dict) else {}


async def _parse_documents_from_request(request: Request) -> tuple[list[dict[str, str]], str | None]:
    if request.headers.get("content-type", "").lower().startswith("multipart/form-data"):
        form = await request.form()
        uploaded_files = [item for item in form.getlist("files") if hasattr(item, "filename") and hasattr(item, "read")]
        document_types = [str(item) for item in form.getlist("document_types")]
        if not uploaded_files:
            return [], "At least one CSV or image file must be uploaded under the files field."
        if len(document_types) != len(uploaded_files):
            return [], "document_types count must match files count."

        documents: list[dict[str, str]] = []
        for document_type, file_storage in zip(document_types, uploaded_files):
            try:
                documents.append(await _convert_uploaded_file(document_type, file_storage))
            except ValueError as exc:
                return [], str(exc)
        return documents, None

    payload = await _json_payload(request)
    documents = payload.get("documents", [])
    if not isinstance(documents, list) or not documents:
        return [], "documents must be a non-empty list."
    return documents, None


@tax_bp.post("/analyze")
async def analyze(request: Request, current_user_id: int = Depends(get_current_user_id)):
    del current_user_id
    payload = await _json_payload(request)
    profile_type = str(payload.get("profile_type", "")).strip().lower()
    regime = str(payload.get("regime", "new")).strip().lower()
    financial_year = str(payload.get("financial_year", DEFAULT_FINANCIAL_YEAR)).strip()
    documents = payload.get("documents", [])
    tax_profile = payload.get("tax_profile", {})

    if not profile_type:
        return _error("profile_type is required.", 400)
    if not isinstance(documents, list) or not documents:
        return _error("documents must be a non-empty list.", 400)

    try:
        result = analyze_tax_documents(
            profile_type=profile_type,
            regime=regime,
            financial_year=financial_year,
            documents=documents,
            tax_profile=tax_profile,
        )
    except ValueError as exc:
        return _error(str(exc), 400)

    return JSONResponse(result, status_code=200 if result.get("status") == "success" else 422)


@tax_bp.post("/analyze-files")
async def analyze_files(request: Request, current_user_id: int = Depends(get_current_user_id)):
    del current_user_id
    form = await request.form()
    profile_type = str(form.get("profile_type", "")).strip().lower()
    regime = str(form.get("regime", "new")).strip().lower()
    financial_year = str(form.get("financial_year", DEFAULT_FINANCIAL_YEAR)).strip()
    uploaded_files = [item for item in form.getlist("files") if hasattr(item, "filename") and hasattr(item, "read")]
    document_types = [str(item) for item in form.getlist("document_types")]

    if not profile_type:
        return _error("profile_type is required.", 400)
    if not uploaded_files:
        return _error("At least one CSV or image file must be uploaded under the files field.", 400)
    if len(document_types) != len(uploaded_files):
        return _error("document_types count must match files count.", 400)

    documents: list[dict[str, str]] = []
    for document_type, file_storage in zip(document_types, uploaded_files):
        try:
            documents.append(await _convert_uploaded_file(document_type, file_storage))
        except ValueError as exc:
            return _error(str(exc), 400)

    tax_profile: dict[str, Any] = {}
    raw_tax_profile = form.get("tax_profile")
    if raw_tax_profile:
        try:
            tax_profile = json.loads(str(raw_tax_profile))
        except json.JSONDecodeError:
            return _error("tax_profile must be valid JSON.", 400)

    try:
        result = analyze_tax_documents(
            profile_type=profile_type,
            regime=regime,
            financial_year=financial_year,
            documents=documents,
            tax_profile=tax_profile,
        )
    except ValueError as exc:
        return _error(str(exc), 400)

    return JSONResponse(result, status_code=200 if result.get("status") == "success" else 422)


@tax_bp.post("/ask")
async def ask(request: Request, current_user_id: int = Depends(get_current_user_id)):
    del current_user_id
    payload = await _json_payload(request)
    question = str(payload.get("question", "")).strip()
    analysis = payload.get("analysis")

    if not isinstance(analysis, dict):
        return _error("analysis must be the JSON result returned by an analyze endpoint.", 400)

    return answer_tax_question(analysis, question)


@tax_bp.post("/jobs")
async def create_job(request: Request, current_user_id: int = Depends(get_current_user_id)):
    payload = await _json_payload(request)
    profile_type = str(payload.get("profile_type", "individual")).strip().lower()
    regime_preference = str(payload.get("regime", "auto")).strip().lower()
    financial_year = str(payload.get("financial_year", DEFAULT_FINANCIAL_YEAR)).strip()
    taxpayer_profile = payload.get("taxpayer_profile", {})
    tax_profile = payload.get("tax_profile", {})

    if profile_type not in {"individual", "small_business"}:
        return _error("profile_type must be 'individual' or 'small_business'.", 400)
    if regime_preference not in {"old", "new", "auto"}:
        return _error("regime must be 'old', 'new', or 'auto'.", 400)

    job = create_filing_job(
        user_id=current_user_id,
        profile_type=profile_type,
        regime_preference=regime_preference,
        financial_year=financial_year,
        taxpayer_profile=taxpayer_profile if isinstance(taxpayer_profile, dict) else {},
        tax_profile=tax_profile if isinstance(tax_profile, dict) else {},
    )
    return JSONResponse({"status": "success", "job": job.to_dict()}, status_code=201)


@tax_bp.get("/jobs")
def list_jobs(current_user_id: int = Depends(get_current_user_id)):
    jobs = TaxFilingJob.query.filter_by(user_id=current_user_id).order_by(TaxFilingJob.id.desc()).all()
    return {
        "jobs": [
            {
                **job.to_dict(),
                "documents": [document.to_dict() for document in job.documents],
            }
            for job in jobs
        ]
    }


@tax_bp.get("/dashboard/financial-data")
def dashboard_financial_data(current_user_id: int = Depends(get_current_user_id)):
    jobs = (
        TaxFilingJob.query.filter_by(user_id=current_user_id)
        .order_by(TaxFilingJob.updated_at.desc(), TaxFilingJob.id.desc())
        .all()
    )
    processed_jobs = [job for job in jobs if isinstance(job.processing_result, dict) and job.processing_result]
    if not processed_jobs:
        return _empty_dashboard_payload()

    return _build_dashboard_payload(processed_jobs[0])


@tax_bp.post("/jobs/{job_id}/documents")
async def upload_job_documents(job_id: str, request: Request, current_user_id: int = Depends(get_current_user_id)):
    job = _get_job_or_404(job_id, current_user_id)
    if job is None:
        return _error("Job not found.", 404)

    documents, error = await _parse_documents_from_request(request)
    if error:
        return _error(error, 400)

    uploads = attach_documents_to_job(job, documents)
    return JSONResponse(
        {"status": "success", "job": job.to_dict(), "documents": [upload.to_dict() for upload in uploads]},
        status_code=201,
    )


@tax_bp.post("/jobs/{job_id}/process")
def process_job(job_id: str, current_user_id: int = Depends(get_current_user_id)):
    job = _get_job_or_404(job_id, current_user_id)
    if job is None:
        return _error("Job not found.", 404)
    if not job.documents:
        return _error("At least one document must be uploaded before processing.", 400)

    result = process_filing_job(job)
    status_code = 200 if result.get("status") == "success" else 422
    return JSONResponse(result, status_code=status_code)


@tax_bp.get("/jobs/{job_id}/review")
def review_job(job_id: str, current_user_id: int = Depends(get_current_user_id)):
    job = _get_job_or_404(job_id, current_user_id)
    if job is None:
        return _error("Job not found.", 404)
    if not job.processing_result:
        return _error("Job has not been processed yet.", 400)

    response = dict(job.processing_result)
    response["job"] = {
        **job.to_dict(),
        "documents": [document.to_dict() for document in job.documents],
    }
    return response


@tax_bp.post("/jobs/{job_id}/approve")
async def approve_job(job_id: str, request: Request, current_user_id: int = Depends(get_current_user_id)):
    job = _get_job_or_404(job_id, current_user_id)
    if job is None:
        return _error("Job not found.", 404)

    payload = await _json_payload(request)
    try:
        result = approve_filing_job(job, payload)
    except ValueError as exc:
        db.session.rollback()
        return _error(str(exc), 400)
    return result


@tax_bp.get("/jobs/{job_id}/export/itr-pdf")
def export_itr_pdf(job_id: str, current_user_id: int = Depends(get_current_user_id)):
    job = _get_job_or_404(job_id, current_user_id)
    if job is None:
        return _error("Job not found.", 404)
    if job.status not in {"approved", "exported"}:
        return _error("Job must be approved before exporting the ITR PDF.", 400)

    result = dict(job.processing_result or {})
    draft_return = result.get("draft_return")
    review_state = result.get("review_state")
    if not draft_return or not review_state:
        return _error("Processed draft return is unavailable for this job.", 400)

    pdf_export = result.get("pdf_export", {})
    pdf_path = pdf_export.get("path")
    if not pdf_path or not os.path.exists(pdf_path):
        config = get_runtime_config()
        pdf_path = save_itr_pdf(
            config.PDF_EXPORT_DIR,
            f"itr_draft_{job.job_id}.pdf",
            draft_return,
            review_state,
        )
        result["pdf_export"] = {
            "path": pdf_path,
            "status": "stored",
            "filename": os.path.basename(pdf_path),
        }
        job.processing_result = result

    job.status = "exported"
    db.session.commit()
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=os.path.basename(pdf_path),
    )
