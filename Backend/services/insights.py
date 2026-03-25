from __future__ import annotations

from typing import Any

import pandas as pd


def generate_insights(df: pd.DataFrame, gst_summary: dict[str, Any], pnl: dict[str, Any]) -> list[dict[str, Any]]:
    insights: list[dict[str, Any]] = []

    total_expense = df.loc[df["txn_type"] == "expense", "taxable_value"].sum()
    category_spend = (
        df[df["txn_type"] == "expense"]
        .groupby("category", as_index=False)["taxable_value"]
        .sum()
        .sort_values(by="taxable_value", ascending=False)
    )

    if not category_spend.empty and total_expense > 0:
        top = category_spend.iloc[0]
        share = float((top["taxable_value"] / total_expense) * 100)
        if share > 35:
            insights.append(
                {
                    "type": "cost-control",
                    "message": f"{top['category']} contributes {share:.1f}% of expenses. Review vendors and pricing.",
                    "priority": "high",
                }
            )

    net_payable = float(gst_summary["net_gst_payable"])
    if net_payable > 0:
        insights.append(
            {
                "type": "gst-alert",
                "message": f"Estimated GST payable is Rs {net_payable:.2f}. Keep reserve funds before filing due date.",
                "priority": "high",
            }
        )

    monthly = df.copy()
    monthly["month"] = pd.to_datetime(monthly["date"]).dt.to_period("M").astype(str)
    monthly_profit = (
        monthly.groupby(["month", "txn_type"]) ["taxable_value"]
        .sum()
        .unstack(fill_value=0)
        .reset_index()
    )

    if len(monthly_profit) >= 2:
        monthly_profit["net"] = monthly_profit.get("income", 0) - monthly_profit.get("expense", 0)
        latest = float(monthly_profit.iloc[-1]["net"])
        previous = float(monthly_profit.iloc[-2]["net"])
        if previous > 0 and latest < previous * 0.85:
            change = ((latest - previous) / previous) * 100
            insights.append(
                {
                    "type": "profit-trend",
                    "message": f"Net profit dropped {abs(change):.1f}% vs previous month. Investigate major variable expenses.",
                    "priority": "medium",
                }
            )

    # Practical tax hint with assumptions visible to user.
    if pnl["net_profit"] > 0:
        insights.append(
            {
                "type": "tax-saving",
                "message": "Consider deductions under section 80C (PF/ELSS/LIC) up to current statutory limits if not already claimed.",
                "priority": "medium",
            }
        )

    if not insights:
        insights.append(
            {
                "type": "info",
                "message": "No major risks found in this dataset. Continue monthly bookkeeping for more reliable insights.",
                "priority": "low",
            }
        )

    return insights
