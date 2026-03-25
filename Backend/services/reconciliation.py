from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict
from typing import Any

from services.canonical_tax_model import CanonicalTaxModel


def _group_amounts(items: list[dict[str, Any]]) -> dict[str, float]:
    grouped: dict[str, float] = defaultdict(float)
    for item in items:
        grouped[str(item["key"])] += float(item["amount"])
    return {key: round(value, 2) for key, value in grouped.items()}


def reconcile_canonical_data(model: CanonicalTaxModel) -> dict[str, Any]:
    incomes = [asdict(item) for item in model.incomes]
    deductions = [asdict(item) for item in model.deductions]
    tax_credits = [asdict(item) for item in model.tax_credits]

    income_totals = _group_amounts(incomes)
    deduction_totals = _group_amounts(deductions)
    credit_totals = _group_amounts(tax_credits)

    issues: list[dict[str, Any]] = []
    review_tasks = list(model.review_tasks)

    salary = income_totals.get("salary", 0.0)
    ais_salary = 0.0
    for income in incomes:
        if income["key"] == "salary" and any(ev.get("document_type") == "ais" for ev in income.get("evidence", [])):
            ais_salary += float(income["amount"])
    if salary and ais_salary and abs(salary - ais_salary) > 1000:
        issues.append(
            {
                "type": "income_mismatch",
                "severity": "high",
                "field": "salary",
                "message": "Salary reported across Form 16 and AIS is materially mismatched.",
                "amounts": {"form16_or_other_salary": salary, "ais_salary": round(ais_salary, 2)},
            }
        )

    if credit_totals.get("form16_tds", 0.0) == 0 and credit_totals.get("ais_tds", 0.0) == 0 and salary > 0:
        issues.append(
            {
                "type": "missing_tax_credit",
                "severity": "medium",
                "field": "tds",
                "message": "Salary income exists but no TDS credits were detected.",
            }
        )

    for fact in model.incomes + model.deductions + model.tax_credits:
        if fact.review_required:
            review_tasks.append(
                {
                    "type": "low_confidence_fact",
                    "severity": "medium",
                    "field": fact.key,
                    "message": f"{fact.key} was inferred with confidence {fact.confidence:.2f} and should be reviewed.",
                    "confidence": fact.confidence,
                    "extraction_method": fact.extraction_method,
                }
            )

    return {
        "income_totals": income_totals,
        "deduction_totals": deduction_totals,
        "credit_totals": credit_totals,
        "issues": issues,
        "review_tasks": review_tasks,
    }
