from __future__ import annotations

from typing import Any

from services.canonical_tax_model import CanonicalTaxModel, EvidenceReference, ExtractedFact
from services.document_ingestion import ParsedDocument
from services.groq_ai import classify_bank_income_rows


def _evidence_from_document(document: ParsedDocument) -> list[EvidenceReference]:
    return [
        EvidenceReference(
            document_type=document.document_type,
            source_name=document.source_name,
            summary=document.summary,
        )
    ]


def _infer_confidence(document_type: str) -> float:
    confidence_map = {
        "form16": 0.98,
        "ais": 0.96,
        "capital_gains_statement": 0.92,
        "interest_certificate": 0.94,
        "rent_summary": 0.9,
        "deduction_proof": 0.88,
        "bank_statement": 0.82,
        "sales_register": 0.9,
        "purchase_register": 0.9,
    }
    return confidence_map.get(document_type, 0.75)


def _review_required(document_type: str, confidence: float) -> bool:
    return confidence < 0.9 or document_type in {"bank_statement", "deduction_proof", "rent_summary"}


def _fact(
    *,
    fact_type: str,
    key: str,
    amount: float,
    document: ParsedDocument,
    extraction_method: str,
    metadata: dict[str, Any] | None = None,
) -> ExtractedFact:
    confidence = _infer_confidence(document.document_type)
    return ExtractedFact(
        fact_type=fact_type,
        key=key,
        amount=round(float(amount or 0.0), 2),
        confidence=confidence,
        extraction_method=extraction_method,
        review_required=_review_required(document.document_type, confidence),
        evidence=_evidence_from_document(document),
        metadata=metadata or {},
    )


def _append_bank_income_from_groq(model: CanonicalTaxModel, document: ParsedDocument) -> bool:
    normalized = document.normalized
    income_rows = normalized[normalized["txn_type"] == "income"].copy()
    if income_rows.empty:
        return False

    candidate_rows = []
    for row_index, row in income_rows.head(20).iterrows():
        candidate_rows.append(
            {
                "row_id": str(row_index),
                "date": row.get("date"),
                "description": row.get("description", ""),
                "amount": round(float(row.get("amount", 0.0)), 2),
            }
        )

    llm_result = classify_bank_income_rows(candidate_rows)
    if not llm_result:
        model.ai_audit_trail.append(
            {
                "engine": "groq_bank_income_classifier_v1",
                "document_type": document.document_type,
                "source_name": document.source_name,
                "success": False,
                "reason": "provider_unavailable_or_disabled",
            }
        )
        return False
    if not llm_result.get("meta", {}).get("success"):
        model.ai_audit_trail.append(
            {
                "engine": "groq_bank_income_classifier_v1",
                "document_type": document.document_type,
                "source_name": document.source_name,
                **llm_result.get("meta", {}),
            }
        )
        return False

    totals: dict[str, float] = {}
    classifications_by_id = {item["row_id"]: item for item in llm_result["classifications"]}
    for row_index, row in income_rows.head(20).iterrows():
        item = classifications_by_id.get(str(row_index))
        if not item:
            continue
        label = item["label"]
        confidence = float(item["confidence"])
        if label in {"transfer", "unknown"}:
            continue
        totals[label] = round(totals.get(label, 0.0) + float(row.get("amount", 0.0)), 2)

        model.ai_audit_trail.append(
            {
                "engine": "groq_bank_income_classifier_v1",
                "model": llm_result["model"],
                "document_type": document.document_type,
                "source_name": document.source_name,
                "transport": llm_result.get("meta", {}).get("transport"),
                "row_id": str(row_index),
                "classification": label,
                "confidence": confidence,
                "reason": item.get("reason", ""),
                "success": True,
            }
        )

    for key, amount in totals.items():
        model.incomes.append(
            ExtractedFact(
                fact_type="income",
                key=key,
                amount=amount,
                confidence=0.9,
                extraction_method="groq_bank_income_classifier_v1",
                review_required=key in {"professional_receipts", "sales", "other_income"},
                evidence=_evidence_from_document(document),
                metadata={
                    "provider": "groq",
                    "batched_rows": llm_result["rows_sent"],
                },
            )
        )
    return bool(totals)


def build_canonical_tax_model(
    *,
    taxpayer_profile: dict[str, Any],
    filing_context: dict[str, Any],
    parsed_documents: list[ParsedDocument],
    tax_profile: dict[str, Any] | None = None,
) -> CanonicalTaxModel:
    tax_profile = tax_profile or {}
    model = CanonicalTaxModel(
        taxpayer_profile=taxpayer_profile,
        filing_context=filing_context,
        documents=[
            {
                "document_type": document.document_type,
                "source_name": document.source_name,
                "summary": document.summary,
            }
            for document in parsed_documents
        ],
    )

    for document in parsed_documents:
        normalized = document.normalized

        if document.document_type == "form16":
            model.incomes.append(
                _fact(
                    fact_type="income",
                    key="salary",
                    amount=normalized.get("taxable_salary") or normalized.get("gross_salary", 0.0),
                    document=document,
                    extraction_method="document_summary_parse_v1",
                )
            )
            model.tax_credits.append(
                _fact(
                    fact_type="tax_credit",
                    key="form16_tds",
                    amount=normalized.get("tds", 0.0),
                    document=document,
                    extraction_method="document_summary_parse_v1",
                )
            )

        elif document.document_type == "ais":
            grouped = normalized.groupby("income_type", as_index=False)["amount"].sum()
            for _, row in grouped.iterrows():
                model.incomes.append(
                    _fact(
                        fact_type="income",
                        key=str(row["income_type"]),
                        amount=row["amount"],
                        document=document,
                        extraction_method="ais_category_grouping_v1",
                    )
                )
            model.tax_credits.append(
                _fact(
                    fact_type="tax_credit",
                    key="ais_tds",
                    amount=normalized.get("tds", 0).sum(),
                    document=document,
                    extraction_method="ais_tds_grouping_v1",
                )
            )
            model.tax_credits.append(
                _fact(
                    fact_type="tax_credit",
                    key="ais_tcs",
                    amount=normalized.get("tcs", 0).sum(),
                    document=document,
                    extraction_method="ais_tcs_grouping_v1",
                )
            )

        elif document.document_type == "bank_statement":
            used_llm = _append_bank_income_from_groq(model, document)
            if not used_llm:
                income_rows = normalized[normalized["txn_type"] == "income"]
                for category, amount in income_rows.groupby("category")["amount"].sum().items():
                    if category in {"interest", "rent", "professional_receipts", "sales", "salary"}:
                        model.incomes.append(
                            _fact(
                                fact_type="income",
                                key=str(category),
                                amount=amount,
                                document=document,
                                extraction_method="bank_transaction_classification_v1",
                            )
                        )

        elif document.document_type == "capital_gains_statement":
            model.incomes.append(
                _fact(
                    fact_type="income",
                    key="capital_gains",
                    amount=normalized.get("net_gain", 0.0),
                    document=document,
                    extraction_method="capital_gains_summary_v1",
                )
            )

        elif document.document_type == "interest_certificate":
            model.incomes.append(
                _fact(
                    fact_type="income",
                    key="interest",
                    amount=normalized.get("interest_income", 0.0),
                    document=document,
                    extraction_method="interest_certificate_summary_v1",
                )
            )
            model.tax_credits.append(
                _fact(
                    fact_type="tax_credit",
                    key="interest_tds",
                    amount=normalized.get("tds", 0.0),
                    document=document,
                    extraction_method="interest_certificate_summary_v1",
                )
            )

        elif document.document_type == "rent_summary":
            model.incomes.append(
                _fact(
                    fact_type="income",
                    key="rent",
                    amount=normalized.get("annual_rent_received", 0.0),
                    document=document,
                    extraction_method="rent_summary_parse_v1",
                )
            )

        elif document.document_type == "deduction_proof":
            for deduction_key, amount in normalized.get("deductions", {}).items():
                model.deductions.append(
                    _fact(
                        fact_type="deduction",
                        key=deduction_key,
                        amount=amount,
                        document=document,
                        extraction_method="deduction_proof_parse_v1",
                    )
                )

        elif document.document_type in {"sales_register", "purchase_register"}:
            key = "business_turnover" if document.document_type == "sales_register" else "business_expenses"
            model.incomes.append(
                _fact(
                    fact_type="income",
                    key=key,
                    amount=normalized["amount"].sum(),
                    document=document,
                    extraction_method="business_register_summary_v1",
                )
            )

    for deduction_key, amount in (tax_profile.get("deductions") or {}).items():
        model.deductions.append(
            ExtractedFact(
                fact_type="deduction",
                key=str(deduction_key).strip().lower(),
                amount=round(float(amount or 0.0), 2),
                confidence=1.0,
                extraction_method="user_declared_profile_v1",
                review_required=False,
                metadata={"declared_by_user": True},
            )
        )

    advance_tax = round(float(tax_profile.get("advance_tax", 0.0)), 2)
    if advance_tax:
        model.tax_credits.append(
            ExtractedFact(
                fact_type="tax_credit",
                key="advance_tax",
                amount=advance_tax,
                confidence=1.0,
                extraction_method="user_declared_profile_v1",
                review_required=False,
                metadata={"declared_by_user": True},
            )
        )

    model.ai_audit_trail.append(
        {
            "engine": "taxai_hybrid_extraction_v1",
            "description": "Structured extraction with deterministic parsers and optional Groq classification for ambiguous income rows.",
            "documents_considered": len(parsed_documents),
        }
    )
    return model
