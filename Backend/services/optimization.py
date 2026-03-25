from __future__ import annotations

from typing import Any


def recommend_tax_optimizations(
    *,
    old_regime_result: dict[str, Any] | None,
    new_regime_result: dict[str, Any] | None,
    canonical_data: dict[str, Any],
) -> dict[str, Any]:
    recommendations: list[dict[str, Any]] = []

    if old_regime_result and new_regime_result:
        old_tax = old_regime_result["tax_computation"]["total_tax_liability"]
        new_tax = new_regime_result["tax_computation"]["total_tax_liability"]
        chosen = "old" if old_tax < new_tax else "new"
        delta = round(abs(old_tax - new_tax), 2)
        recommendations.append(
            {
                "type": "regime_selection",
                "selected_regime": chosen,
                "estimated_tax_saved": delta,
                "message": f"{chosen.title()} regime is currently more tax-efficient by Rs {delta:.2f}.",
            }
        )

    deduction_total = sum(item.get("amount", 0.0) for item in canonical_data.get("deductions", []))
    if deduction_total < 150000:
        recommendations.append(
            {
                "type": "deduction_opportunity",
                "message": "Declared Chapter VI-A deductions appear limited. Review 80C, 80D, and NPS eligibility before final filing.",
            }
        )

    if not recommendations:
        recommendations.append(
            {
                "type": "information",
                "message": "No additional optimization opportunities were detected from the current dataset.",
            }
        )

    return {
        "recommendations": recommendations,
    }
