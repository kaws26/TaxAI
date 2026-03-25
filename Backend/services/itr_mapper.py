from __future__ import annotations

from typing import Any


def map_to_itr_draft(
    *,
    job_id: str,
    profile_type: str,
    canonical_data: dict[str, Any],
    tax_result: dict[str, Any],
    reconciliation: dict[str, Any],
) -> dict[str, Any]:
    filing_position = tax_result.get("filing_position", {})
    deductions = tax_result.get("deductions", {})
    tax_credits = tax_result.get("tax_credits", {})

    return {
        "job_id": job_id,
        "suggested_itr_form": filing_position.get("suggested_itr_form", "manual review needed"),
        "profile_type": profile_type,
        "financial_year": tax_result.get("financial_year"),
        "regime": tax_result.get("regime"),
        "itr_fields": {
            "gross_total_income": tax_result.get("gross_total_income", 0.0),
            "total_deductions": deductions.get("total_deductions", 0.0),
            "taxable_income": tax_result.get("taxable_income", 0.0),
            "tax_before_rebate": tax_result.get("tax_computation", {}).get("tax_before_rebate", 0.0),
            "total_tax_liability": tax_result.get("tax_computation", {}).get("total_tax_liability", 0.0),
            "total_taxes_paid": tax_credits.get("total_taxes_paid", 0.0),
            "refund_due": tax_result.get("net_result", {}).get("refund_due", 0.0),
            "balance_tax_payable": tax_result.get("net_result", {}).get("balance_tax_payable", 0.0),
        },
        "income_schedule": tax_result.get("income_breakdown", {}),
        "deduction_schedule": deductions,
        "credit_schedule": tax_credits,
        "reconciliation_summary": {
            "issues_count": len(reconciliation.get("issues", [])),
            "review_tasks_count": len(reconciliation.get("review_tasks", [])),
        },
        "canonical_documents": canonical_data.get("documents", []),
    }
