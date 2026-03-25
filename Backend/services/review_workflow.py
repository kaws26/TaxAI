from __future__ import annotations

from typing import Any


def build_review_state(
    *,
    reconciliation: dict[str, Any],
    tax_result: dict[str, Any],
) -> dict[str, Any]:
    review_blockers: list[dict[str, Any]] = []

    for issue in reconciliation.get("issues", []):
        if issue.get("severity") == "high":
            review_blockers.append(issue)


    for flag in tax_result.get("compliance_flags", []):
        if flag.get("severity") == "high":
            review_blockers.append(flag)

    return {
        "ready_for_approval": not review_blockers,
        "review_blockers": review_blockers,
        "review_tasks": reconciliation.get("review_tasks", []),
    }


def next_status_for_processed_job(review_state: dict[str, Any]) -> str:
    return "computed" if review_state["ready_for_approval"] else "needs_review"
