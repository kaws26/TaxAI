from __future__ import annotations

from typing import Any

import pandas as pd

from services.tax_constants import DEFAULT_FINANCIAL_YEAR
from services.tax_engine import build_tax_computation


def compute_tax_for_fy_2024_25(
    *,
    profile_type: str,
    regime: str,
    financial_year: str,
    bank_transactions: pd.DataFrame,
    ais_entries: pd.DataFrame,
    form16_summaries: list[dict[str, Any]],
    business_working: dict[str, Any],
    tax_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return build_tax_computation(
        profile_type=profile_type,
        regime=regime,
        financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
        bank_transactions=bank_transactions,
        ais_entries=ais_entries,
        form16_summaries=form16_summaries,
        business_working=business_working,
        tax_profile=tax_profile,
    )
