from __future__ import annotations

from typing import Any

import pandas as pd


def add_taxable_values(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    rate_fraction = result["gst_rate"] / 100.0

    inclusive = result["amount_inclusive_gst"] == True
    result["taxable_value"] = result["amount"]
    result.loc[inclusive, "taxable_value"] = result.loc[inclusive, "amount"] / (1 + rate_fraction[inclusive])
    result["gst_amount"] = result["amount"] - result["taxable_value"]

    return result


def generate_ledger(df: pd.DataFrame) -> pd.DataFrame:
    ledger_rows = []

    for _, row in df.iterrows():
        if row["txn_type"] == "income":
            ledger_rows.append(
                {
                    "date": row["date"],
                    "narration": row["description"],
                    "debit_account": "Cash/Bank",
                    "credit_account": "Sales",
                    "amount": round(float(row["taxable_value"]), 2),
                    "category": row["category"],
                }
            )
        else:
            ledger_rows.append(
                {
                    "date": row["date"],
                    "narration": row["description"],
                    "debit_account": row["category"],
                    "credit_account": "Cash/Bank",
                    "amount": round(float(row["taxable_value"]), 2),
                    "category": row["category"],
                }
            )

    return pd.DataFrame(ledger_rows)


def profit_and_loss(df: pd.DataFrame) -> dict[str, Any]:
    income = df.loc[df["txn_type"] == "income", "taxable_value"].sum()
    expenses = df.loc[df["txn_type"] == "expense", "taxable_value"].sum()
    gross_profit = income - expenses

    return {
        "revenue": round(float(income), 2),
        "expenses": round(float(expenses), 2),
        "net_profit": round(float(gross_profit), 2),
        "net_margin_pct": round(float((gross_profit / income) * 100), 2) if income else 0.0,
    }


def basic_balance_sheet(pnl: dict[str, Any]) -> dict[str, Any]:
    net_profit = pnl["net_profit"]
    cash = max(net_profit, 0.0)

    return {
        "assets": {
            "cash_and_bank": round(cash, 2),
            "receivables_estimate": 0.0,
        },
        "liabilities": {
            "payables_estimate": 0.0,
        },
        "equity": {
            "retained_earnings": round(net_profit, 2),
        },
    }
