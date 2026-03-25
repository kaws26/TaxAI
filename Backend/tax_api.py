from __future__ import annotations

import json
import os
from typing import Any

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models import TaxFilingJob
from services.pdf_export import save_itr_pdf
from services.groq_ai import groq_status
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


tax_bp = Blueprint("tax_assistant", __name__, url_prefix="/api/tax-assistant")


def _error(message: str, status_code: int):
    return jsonify({"message": message}), status_code


@tax_bp.get("/options")
def options():
    return jsonify(
        {
            "profile_types": ["individual", "small_business"],
            "regimes": ["old", "new", "auto"],
            "default_financial_year": DEFAULT_FINANCIAL_YEAR,
            "supported_documents": SUPPORTED_DOCUMENTS,
            "job_statuses": sorted(JOB_STATUSES),
            "portal_adapter": portal_adapter_capabilities(),
            "ai_provider": groq_status(),
        }
    )


def _current_user_id() -> int:
    return int(get_jwt_identity())


def _get_job_or_404(job_id: str) -> TaxFilingJob | None:
    job = TaxFilingJob.query.filter_by(job_id=job_id, user_id=_current_user_id()).first()
    if job is None:
        return None
    return job


def _parse_documents_from_request() -> tuple[list[dict[str, str]], str | None]:
    if request.files:
        uploaded_files = request.files.getlist("files")
        document_types = request.form.getlist("document_types")
        if not uploaded_files:
            return [], "At least one CSV file must be uploaded under the files field."
        if len(document_types) != len(uploaded_files):
            return [], "document_types count must match files count."

        documents: list[dict[str, str]] = []
        for document_type, file_storage in zip(document_types, uploaded_files):
            if not file_storage.filename.lower().endswith(".csv"):
                return [], f"{file_storage.filename} is not a CSV file."
            documents.append(
                {
                    "document_type": document_type,
                    "source_name": file_storage.filename,
                    "csv_content": file_storage.read().decode("utf-8"),
                }
            )
        return documents, None

    payload: dict[str, Any] = request.get_json(silent=True) or {}
    documents = payload.get("documents", [])
    if not isinstance(documents, list) or not documents:
        return [], "documents must be a non-empty list."
    return documents, None


@tax_bp.post("/analyze")
@jwt_required()
def analyze():
    payload: dict[str, Any] = request.get_json(silent=True) or {}
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

    return jsonify(result), 200 if result.get("status") == "success" else 422


@tax_bp.post("/analyze-files")
@jwt_required()
def analyze_files():
    profile_type = str(request.form.get("profile_type", "")).strip().lower()
    regime = str(request.form.get("regime", "new")).strip().lower()
    financial_year = str(request.form.get("financial_year", DEFAULT_FINANCIAL_YEAR)).strip()
    uploaded_files = request.files.getlist("files")
    document_types = request.form.getlist("document_types")

    if not profile_type:
        return _error("profile_type is required.", 400)
    if not uploaded_files:
        return _error("At least one CSV file must be uploaded under the files field.", 400)
    if len(document_types) != len(uploaded_files):
        return _error("document_types count must match files count.", 400)

    documents: list[dict[str, str]] = []
    for document_type, file_storage in zip(document_types, uploaded_files):
        if not file_storage.filename.lower().endswith(".csv"):
            return _error(f"{file_storage.filename} is not a CSV file.", 400)
        documents.append(
            {
                "document_type": document_type,
                "source_name": file_storage.filename,
                "csv_content": file_storage.read().decode("utf-8"),
            }
        )

    tax_profile: dict[str, Any] = {}
    raw_tax_profile = request.form.get("tax_profile")
    if raw_tax_profile:
        try:
            tax_profile = json.loads(raw_tax_profile)
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

    return jsonify(result), 200 if result.get("status") == "success" else 422


@tax_bp.post("/ask")
@jwt_required()
def ask():
    payload: dict[str, Any] = request.get_json(silent=True) or {}
    question = str(payload.get("question", "")).strip()
    analysis = payload.get("analysis")

    if not isinstance(analysis, dict):
        return _error("analysis must be the JSON result returned by an analyze endpoint.", 400)

    return jsonify(answer_tax_question(analysis, question))


@tax_bp.post("/jobs")
@jwt_required()
def create_job():
    payload: dict[str, Any] = request.get_json(silent=True) or {}
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
        user_id=_current_user_id(),
        profile_type=profile_type,
        regime_preference=regime_preference,
        financial_year=financial_year,
        taxpayer_profile=taxpayer_profile if isinstance(taxpayer_profile, dict) else {},
        tax_profile=tax_profile if isinstance(tax_profile, dict) else {},
    )
    return jsonify({"status": "success", "job": job.to_dict()}), 201


@tax_bp.get("/jobs")
@jwt_required()
def list_jobs():
    jobs = TaxFilingJob.query.filter_by(user_id=_current_user_id()).order_by(TaxFilingJob.id.desc()).all()
    return jsonify(
        {
            "jobs": [
                {
                    **job.to_dict(),
                    "documents": [document.to_dict() for document in job.documents],
                }
                for job in jobs
            ]
        }
    )


@tax_bp.post("/jobs/<job_id>/documents")
@jwt_required()
def upload_job_documents(job_id: str):
    job = _get_job_or_404(job_id)
    if job is None:
        return _error("Job not found.", 404)

    documents, error = _parse_documents_from_request()
    if error:
        return _error(error, 400)

    uploads = attach_documents_to_job(job, documents)
    return jsonify({"status": "success", "job": job.to_dict(), "documents": [upload.to_dict() for upload in uploads]}), 201


@tax_bp.post("/jobs/<job_id>/process")
@jwt_required()
def process_job(job_id: str):
    job = _get_job_or_404(job_id)
    if job is None:
        return _error("Job not found.", 404)
    if not job.documents:
        return _error("At least one document must be uploaded before processing.", 400)

    result = process_filing_job(job)
    status_code = 200 if result.get("status") == "success" else 422
    return jsonify(result), status_code


@tax_bp.get("/jobs/<job_id>/review")
@jwt_required()
def review_job(job_id: str):
    job = _get_job_or_404(job_id)
    if job is None:
        return _error("Job not found.", 404)
    if not job.processing_result:
        return _error("Job has not been processed yet.", 400)

    response = dict(job.processing_result)
    response["job"] = {
        **job.to_dict(),
        "documents": [document.to_dict() for document in job.documents],
    }
    return jsonify(response)


@tax_bp.post("/jobs/<job_id>/approve")
@jwt_required()
def approve_job(job_id: str):
    job = _get_job_or_404(job_id)
    if job is None:
        return _error("Job not found.", 404)

    payload: dict[str, Any] = request.get_json(silent=True) or {}
    try:
        result = approve_filing_job(job, payload)
    except ValueError as exc:
        db.session.rollback()
        return _error(str(exc), 400)
    return jsonify(result)


@tax_bp.get("/jobs/<job_id>/export/itr-pdf")
@jwt_required()
def export_itr_pdf(job_id: str):
    job = _get_job_or_404(job_id)
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
        pdf_path = save_itr_pdf(
            current_app.config["PDF_EXPORT_DIR"],
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
    return send_file(
        pdf_path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=os.path.basename(pdf_path),
    )
