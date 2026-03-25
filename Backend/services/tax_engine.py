from __future__ import annotations

from typing import Any

import pandas as pd

from services.bookkeeping import add_taxable_values, basic_balance_sheet, generate_ledger, profit_and_loss
from services.gst import compute_gst
from services.insights import generate_insights
from services.tax_constants import (
    CESS_RATE,
    DEFAULT_FINANCIAL_YEAR,
    GST_REGISTRATION_THRESHOLD,
    INDIVIDUAL_NEW_REGIME_SLABS,
    INDIVIDUAL_OLD_REGIME_SLABS,
    NEW_REGIME_ALLOWED_DEDUCTIONS,
    OLD_REGIME_DEDUCTION_LIMITS,
    REBATE_LIMIT,
    STANDARD_DEDUCTION,
    SUPPORTED_FINANCIAL_YEARS,
)


def _sum_frame(frame: pd.DataFrame, income_type: str) -> float:
    if frame.empty:
        return 0.0
    return round(float(frame.loc[frame["income_type"] == income_type, "amount"].sum()), 2)


def _compute_progressive_tax(taxable_income: float, slabs: list[tuple[float, float]]) -> float:
    tax = 0.0
    previous_limit = 0.0

    for limit, rate in slabs:
        if taxable_income <= previous_limit:
            break
        slab_amount = min(taxable_income, limit) - previous_limit
        tax += slab_amount * rate
        previous_limit = limit

    return round(tax, 2)


def _normalize_deductions(deductions: dict[str, Any] | None, regime: str) -> dict[str, float]:
    deductions = deductions or {}
    normalized: dict[str, float] = {}

    for key, value in deductions.items():
        normalized_key = str(key).strip().lower()
        amount = round(float(value or 0), 2)
        if regime == "old":
            limit = OLD_REGIME_DEDUCTION_LIMITS.get(normalized_key)
            normalized[normalized_key] = min(amount, limit) if limit is not None else amount
        elif normalized_key in NEW_REGIME_ALLOWED_DEDUCTIONS:
            normalized[normalized_key] = amount

    return normalized


def _determine_itr_form(profile_type: str, total_income: float, special_income_present: bool, has_business_income: bool) -> str:
    if profile_type == "small_business" or has_business_income:
        return "ITR-3 or ITR-4 depending on presumptive taxation eligibility"
    if total_income <= 5000000 and not special_income_present:
        return "ITR-1"
    return "ITR-2"


def build_business_working(ledger_frames: list[pd.DataFrame]) -> dict[str, Any]:
    if not ledger_frames:
        return {
            "transactions": pd.DataFrame(),
            "ledger": [],
            "profit_and_loss": {"revenue": 0.0, "expenses": 0.0, "net_profit": 0.0, "net_margin_pct": 0.0},
            "balance_sheet": {"assets": {}, "liabilities": {}, "equity": {}},
            "gst_summary": None,
            "insights": [],
        }

    ledger_input = pd.concat(ledger_frames, ignore_index=True)
    ledger_input["gst_rate"] = ledger_input["gst_rate"].fillna(0.0).astype(float)
    ledger_input["amount_inclusive_gst"] = ledger_input["amount_inclusive_gst"].fillna(False).astype(bool)
    ledger_input["eligible_itc"] = ledger_input["eligible_itc"].fillna(False).astype(bool)

    enriched = add_taxable_values(ledger_input)
    ledger = generate_ledger(enriched).to_dict(orient="records")
    pnl = profit_and_loss(enriched)
    balance_sheet = basic_balance_sheet(pnl)
    gst_summary = compute_gst(enriched)
    insights = generate_insights(enriched, gst_summary, pnl)

    return {
        "transactions": enriched,
        "ledger": ledger,
        "profit_and_loss": pnl,
        "balance_sheet": balance_sheet,
        "gst_summary": gst_summary,
        "insights": insights,
    }


def build_tax_computation(
    profile_type: str,
    regime: str,
    financial_year: str,
    bank_transactions: pd.DataFrame,
    ais_entries: pd.DataFrame,
    form16_summaries: list[dict[str, Any]],
    business_working: dict[str, Any],
    tax_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    tax_profile = tax_profile or {}
    regime = regime.lower()
    financial_year = financial_year or DEFAULT_FINANCIAL_YEAR

    warnings: list[str] = []
    if financial_year not in SUPPORTED_FINANCIAL_YEARS:
        warnings.append(
            f"Financial year {financial_year} is not explicitly modeled; using {DEFAULT_FINANCIAL_YEAR} rules as an approximation."
        )

    if regime not in {"old", "new"}:
        raise ValueError("regime must be 'old' or 'new'.")

    salary_from_form16 = round(sum(item.get("taxable_salary") or item.get("gross_salary", 0.0) for item in form16_summaries), 2)
    form16_tds = round(sum(item.get("tds", 0.0) for item in form16_summaries), 2)

    ais_entries = ais_entries if not ais_entries.empty else pd.DataFrame(columns=["income_type", "amount", "tds", "tcs"])
    bank_transactions = (
        bank_transactions if not bank_transactions.empty else pd.DataFrame(columns=["txn_type", "category", "taxable_value", "amount"])
    )

    interest_income = _sum_frame(ais_entries, "interest")
    dividend_income = _sum_frame(ais_entries, "dividend")
    rent_income = _sum_frame(ais_entries, "rent")
    professional_income = _sum_frame(ais_entries, "professional_receipts")
    capital_gains = _sum_frame(ais_entries, "capital_gains")
    other_income = _sum_frame(ais_entries, "other_income")
    ais_tds = round(float(ais_entries.get("tds", pd.Series(dtype=float)).sum()), 2)
    ais_tcs = round(float(ais_entries.get("tcs", pd.Series(dtype=float)).sum()), 2)

    bank_interest = 0.0
    if not bank_transactions.empty and "category" in bank_transactions.columns:
        interest_mask = bank_transactions["category"] == "interest"
        value_column = "taxable_value" if "taxable_value" in bank_transactions.columns else "amount"
        bank_interest = round(float(bank_transactions.loc[interest_mask, value_column].sum()), 2)

    business_profit = round(float(business_working["profit_and_loss"]["net_profit"]), 2)
    gross_total_income = round(
        salary_from_form16
        + interest_income
        + bank_interest
        + dividend_income
        + rent_income
        + professional_income
        + other_income
        + (business_profit if profile_type == "small_business" else 0.0),
        2,
    )

    special_income = {"capital_gains": capital_gains}
    special_income_total = round(sum(special_income.values()), 2)
    if special_income_total > 0:
        warnings.append(
            "Capital gains or special-rate income detected. The engine flags this for review and does not compute special-rate tax schedules automatically."
        )

    standard_deduction = STANDARD_DEDUCTION[regime] if salary_from_form16 > 0 else 0.0
    user_deductions = _normalize_deductions(tax_profile.get("deductions"), regime)
    total_deductions = round(standard_deduction + sum(user_deductions.values()), 2)
    taxable_income = max(gross_total_income - total_deductions, 0.0)

    slabs = INDIVIDUAL_OLD_REGIME_SLABS if regime == "old" else INDIVIDUAL_NEW_REGIME_SLABS
    tax_before_rebate = _compute_progressive_tax(taxable_income, slabs)

    rebate_config = REBATE_LIMIT[regime]
    rebate = min(tax_before_rebate, rebate_config["max_rebate"]) if taxable_income <= rebate_config["income_limit"] else 0.0
    tax_after_rebate = max(tax_before_rebate - rebate, 0.0)
    cess = round(tax_after_rebate * CESS_RATE, 2)
    total_tax_liability = round(tax_after_rebate + cess, 2)

    taxes_paid = round(form16_tds + ais_tds + ais_tcs + float(tax_profile.get("advance_tax", 0.0)), 2)
    balance_tax = round(total_tax_liability - taxes_paid, 2)
    refund_due = round(abs(balance_tax), 2) if balance_tax < 0 else 0.0
    balance_tax_payable = round(balance_tax, 2) if balance_tax > 0 else 0.0

    compliance_flags: list[dict[str, str]] = []
    if profile_type == "small_business":
        turnover = round(float(business_working["profit_and_loss"]["revenue"]), 2)
        if turnover >= GST_REGISTRATION_THRESHOLD:
            compliance_flags.append(
                {
                    "severity": "high",
                    "message": "Business turnover appears above the basic GST threshold. Confirm GST registration status and return filing frequency.",
                }
            )
    if taxes_paid == 0 and total_tax_liability > 0:
        compliance_flags.append(
            {
                "severity": "medium",
                "message": "No tax credits were detected against a positive tax liability. Verify TDS, advance tax, and self-assessment challans.",
            }
        )
    if gross_total_income == 0:
        compliance_flags.append(
            {
                "severity": "medium",
                "message": "No taxable income was detected from the supplied documents. This may indicate missing documents or mismatched CSV formats.",
            }
        )

    assistant_summary = (
        "The assistant combined salary, AIS, bank, and business records into a filing worksheet and computed a draft liability."
        if gross_total_income > 0
        else "The assistant processed the uploaded files but could not detect enough taxable income to prepare a reliable return draft."
    )

    return {
        "financial_year": financial_year,
        "regime": regime,
        "income_breakdown": {
            "salary": salary_from_form16,
            "interest": round(interest_income + bank_interest, 2),
            "dividend": dividend_income,
            "rent": rent_income,
            "professional_receipts": professional_income,
            "business_profit": business_profit if profile_type == "small_business" else 0.0,
            "other_income": other_income,
            "special_rate_income": special_income,
        },
        "gross_total_income": gross_total_income,
        "deductions": {
            "standard_deduction": standard_deduction,
            "chapter_vi_a": user_deductions,
            "total_deductions": total_deductions,
        },
        "taxable_income": taxable_income,
        "tax_computation": {
            "tax_before_rebate": tax_before_rebate,
            "rebate_87a": rebate,
            "cess": cess,
            "total_tax_liability": total_tax_liability,
        },
        "tax_credits": {
            "form16_tds": form16_tds,
            "ais_tds": ais_tds,
            "ais_tcs": ais_tcs,
            "advance_tax": round(float(tax_profile.get("advance_tax", 0.0)), 2),
            "total_taxes_paid": taxes_paid,
        },
        "net_result": {
            "balance_tax_payable": balance_tax_payable,
            "refund_due": refund_due,
        },
        "filing_position": {
            "suggested_itr_form": _determine_itr_form(
                profile_type=profile_type,
                total_income=gross_total_income,
                special_income_present=special_income_total > 0,
                has_business_income=profile_type == "small_business" or business_profit > 0,
            ),
            "ready_for_filing": len([flag for flag in compliance_flags if flag["severity"] == "high"]) == 0,
        },
        "compliance_flags": compliance_flags,
        "warnings": warnings,
        "assistant_summary": assistant_summary,
    }
