from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class EvidenceReference:
    document_type: str
    source_name: str
    summary: dict[str, Any] = field(default_factory=dict)
    source_row: int | None = None


@dataclass(slots=True)
class ExtractedFact:
    fact_type: str
    key: str
    amount: float
    confidence: float
    extraction_method: str
    review_required: bool
    evidence: list[EvidenceReference] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class CanonicalTaxModel:
    taxpayer_profile: dict[str, Any]
    filing_context: dict[str, Any]
    incomes: list[ExtractedFact] = field(default_factory=list)
    deductions: list[ExtractedFact] = field(default_factory=list)
    tax_credits: list[ExtractedFact] = field(default_factory=list)
    documents: list[dict[str, Any]] = field(default_factory=list)
    ai_audit_trail: list[dict[str, Any]] = field(default_factory=list)
    review_tasks: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def summarize_confidence(facts: list[ExtractedFact]) -> dict[str, Any]:
    if not facts:
        return {
            "count": 0,
            "average_confidence": 0.0,
            "low_confidence_items": 0,
        }

    low_confidence_items = sum(1 for fact in facts if fact.review_required)
    return {
        "count": len(facts),
        "average_confidence": round(sum(fact.confidence for fact in facts) / len(facts), 3),
        "low_confidence_items": low_confidence_items,
    }
