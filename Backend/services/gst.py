from __future__ import annotations

from typing import Any

import pandas as pd


def _split_gst(row: pd.Series) -> dict[str, float]:
    same_state = str(row["vendor_state"]).strip().lower() == str(row["business_state"]).strip().lower()
    gst_amount = float(row["gst_amount"])

    if same_state:
        return {
            "cgst": gst_amount / 2,
            "sgst": gst_amount / 2,
            "igst": 0.0,
        }

    return {
        "cgst": 0.0,
        "sgst": 0.0,
        "igst": gst_amount,
    }


def compute_gst(df: pd.DataFrame) -> dict[str, Any]:
    working = df.copy()

    splits = working.apply(_split_gst, axis=1, result_type="expand")
    working = pd.concat([working, splits], axis=1)

    income = working[working["txn_type"] == "income"]
    expense = working[working["txn_type"] == "expense"]

    output_tax = {
        "cgst": round(float(income["cgst"].sum()), 2),
        "sgst": round(float(income["sgst"].sum()), 2),
        "igst": round(float(income["igst"].sum()), 2),
    }

    eligible_expense = expense[expense["eligible_itc"] == True]
    input_credit = {
        "cgst": round(float(eligible_expense["cgst"].sum()), 2),
        "sgst": round(float(eligible_expense["sgst"].sum()), 2),
        "igst": round(float(eligible_expense["igst"].sum()), 2),
    }

    payable = {
        key: round(output_tax[key] - input_credit[key], 2)
        for key in ("cgst", "sgst", "igst")
    }

    total_output = round(sum(output_tax.values()), 2)
    total_input = round(sum(input_credit.values()), 2)
    total_payable = round(total_output - total_input, 2)

    return {
        "output_tax": output_tax,
        "input_tax_credit": input_credit,
        "payable_tax": payable,
        "total_output_tax": total_output,
        "total_input_tax_credit": total_input,
        "net_gst_payable": total_payable,
    }
