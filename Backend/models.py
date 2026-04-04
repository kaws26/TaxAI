from __future__ import annotations

import uuid

from sqlalchemy import Float, func
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    pancard_number = db.Column(db.String(10), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    mobile_number = db.Column(db.String(15), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict[str, str | int]:
        return {
            "id": self.id,
            "name": self.name,
            "pancard_number": self.pancard_number,
            "mobile_number": self.mobile_number,
            "email": self.email,
        }


class TaxFilingJob(db.Model):
    __tablename__ = "tax_filing_jobs"

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()), index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    profile_type = db.Column(db.String(50), nullable=False, default="individual")
    regime_preference = db.Column(db.String(20), nullable=False, default="auto")
    financial_year = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="uploaded", index=True)
    taxpayer_profile = db.Column(db.JSON, nullable=False, default=dict)
    tax_profile = db.Column(db.JSON, nullable=False, default=dict)
    processing_result = db.Column(db.JSON, nullable=True)
    approved_payload = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = db.relationship("User", backref=db.backref("tax_filing_jobs", lazy="select"))
    documents = db.relationship(
        "TaxDocumentUpload",
        backref="job",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="TaxDocumentUpload.id.asc()",
    )
    transactions = db.relationship(
        "TransactionRecord",
        backref="job",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="TransactionRecord.transaction_date.desc(), TransactionRecord.id.desc()",
    )

    def to_dict(self) -> dict[str, object]:
        return {
            "job_id": self.job_id,
            "profile_type": self.profile_type,
            "regime_preference": self.regime_preference,
            "financial_year": self.financial_year,
            "status": self.status,
            "taxpayer_profile": self.taxpayer_profile or {},
            "tax_profile": self.tax_profile or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TaxDocumentUpload(db.Model):
    __tablename__ = "tax_document_uploads"

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey("tax_filing_jobs.id"), nullable=False, index=True)
    document_type = db.Column(db.String(50), nullable=False, index=True)
    source_name = db.Column(db.String(255), nullable=False)
    storage_kind = db.Column(db.String(20), nullable=False, default="inline_csv")
    raw_content = db.Column(db.Text, nullable=False)
    parse_status = db.Column(db.String(20), nullable=False, default="uploaded")
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    transactions = db.relationship(
        "TransactionRecord",
        backref="document_upload",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="TransactionRecord.transaction_date.desc(), TransactionRecord.id.desc()",
    )

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "document_type": self.document_type,
            "source_name": self.source_name,
            "storage_kind": self.storage_kind,
            "parse_status": self.parse_status,
            "metadata": self.metadata_json or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TransactionRecord(db.Model):
    __tablename__ = "transaction_records"

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey("tax_filing_jobs.id"), nullable=False, index=True)
    document_upload_id = db.Column(db.Integer, db.ForeignKey("tax_document_uploads.id"), nullable=False, index=True)
    transaction_date = db.Column(db.String(10), nullable=False, index=True)
    merchant = db.Column(db.String(255), nullable=False, default="")
    description = db.Column(db.Text, nullable=False, default="")
    amount = db.Column(Float, nullable=False, default=0.0)
    txn_type = db.Column(db.String(20), nullable=False, default="expense", index=True)
    category = db.Column(db.String(80), nullable=False, default="Other", index=True)
    source = db.Column(db.String(20), nullable=False, default="CSV", index=True)
    document_type = db.Column(db.String(50), nullable=False, default="", index=True)
    source_name = db.Column(db.String(255), nullable=False, default="")
    confidence = db.Column(Float, nullable=False, default=0.0)
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "job_id": self.job.job_id if self.job else None,
            "document_upload_id": self.document_upload_id,
            "date": self.transaction_date,
            "merchant": self.merchant,
            "amount": round(float(self.amount or 0.0), 2),
            "txn_type": self.txn_type,
            "category": self.category,
            "source": self.source,
            "document_type": self.document_type,
            "source_name": self.source_name,
            "description": self.description,
            "confidence": round(float(self.confidence or 0.0), 3),
            "actions": ["edit", "delete"],
            "metadata": self.metadata_json or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
