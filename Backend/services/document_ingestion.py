from __future__ import annotations

from dataclasses import dataclass
from io import StringIO
from typing import Any

import pandas as pd

from services.tax_constants import SUPPORTED_DOCUMENTS


class DocumentValidationError(ValueError):
    pass


@dataclass(slots=True)
class ParsedDocument:
    document_type: str
    source_name: str
    normalized: Any
    summary: dict[str, Any]


COLUMN_SYNONYMS = {
    "txn_date": "date",
    "transaction_date": "date",
    "value_date": "date",
    "narration": "description",
    "particulars": "description",
    "details": "description",
    "withdrawal": "debit",
    "deposit": "credit",
    "gross_amount": "amount",
    "value": "amount",
    "field": "component",
    "label": "component",
    "nature": "income_type",
    "section_code": "section",
    "customer": "description",
    "vendor": "description",
    "invoice_description": "description",
    "deduction_type": "section",
    "nature_of_income": "income_type",
    "gross_interest": "interest_income",
    "interest_amount": "interest_income",
    "tenant": "tenant_name",
    "annual_rent": "annual_rent_received",
    "sale_consideration": "sale_value",
    "gain": "net_gain",
}

CATEGORY_RULES = {
    "salary": ["salary", "payroll", "employer"],
    "interest": ["interest", "int.pd", "fd int", "savings interest"],
    "rent": ["rent", "lease"],
    "professional_receipts": ["consult", "freelance", "invoice", "receipt from client", "fees"],
    "sales": ["sale", "sales", "customer payment", "upi collect", "order"],
    "software": ["aws", "azure", "gcp", "hosting", "domain", "software", "saas"],
    "travel": ["uber", "ola", "irctc", "flight", "travel"],
    "utilities": ["electricity", "water", "broadband", "internet", "mobile bill"],
    "office_expense": ["stationery", "printer", "office", "supplies"],
    "food": ["swiggy", "zomato", "restaurant"],
    "transfer": ["transfer", "neft", "imps", "rtgs", "upi", "self", "sweep", "card settlement"],
    "loan": ["emi", "loan"],
    "tax_payment": ["income tax", "gst", "tds", "challan"],
}

AIS_CATEGORY_MAP = {
    "salary": "salary",
    "salary received": "salary",
    "interest": "interest",
    "interest from deposit": "interest",
    "dividend": "dividend",
    "rent": "rent",
    "professional fees": "professional_receipts",
    "commission": "professional_receipts",
    "business receipts": "business_receipts",
    "sale of securities": "capital_gains",
    "capital gains": "capital_gains",
}

FORM16_COMPONENT_MAP = {
    "gross salary": "gross_salary",
    "salary as per provisions contained in section 17(1)": "gross_salary",
    "value of perquisites under section 17(2)": "perquisites",
    "profits in lieu of salary under section 17(3)": "profits_in_lieu",
    "less allowances to the extent exempt under section 10": "exempt_allowances",
    "standard deduction under section 16": "standard_deduction",
    "taxable income chargeable under the head salaries": "taxable_salary",
    "tax deducted at source": "tds",
    "total tax deducted": "tds",
    "reported total income": "reported_total_income",
}


def _load_csv(csv_content: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(StringIO(csv_content))
    except Exception as exc:  # pragma: no cover
        raise DocumentValidationError(f"Unable to parse CSV: {exc}") from exc

    if df.empty:
        raise DocumentValidationError("CSV file is empty.")

    return df


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    renamed: dict[str, str] = {}
    for column in df.columns:
        cleaned = str(column).strip().lower().replace(" ", "_")
        renamed[column] = COLUMN_SYNONYMS.get(cleaned, cleaned)
    return df.rename(columns=renamed)


def _has_required_columns(df: pd.DataFrame, groups: list[list[str]]) -> bool:
    available = set(df.columns)
    return all(any(candidate in available for candidate in group) for group in groups)


def _coerce_number(value: Any) -> float:
    if pd.isna(value):
        return 0.0
    text = str(value).strip().replace(",", "")
    if text.startswith("(") and text.endswith(")"):
        text = f"-{text[1:-1]}"
    if text in {"", "-", "nan", "none"}:
        return 0.0
    return float(text)


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if pd.isna(value):
        return default
    text = str(value).strip().lower()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False
    return default


def _infer_category(description: str, default: str) -> str:
    normalized = description.lower()
    for category, keywords in CATEGORY_RULES.items():
        if any(keyword in normalized for keyword in keywords):
            return category
    return default


def _parse_bank_statement(df: pd.DataFrame, source_name: str) -> ParsedDocument:
    if "amount" not in df.columns:
        if "credit" in df.columns or "debit" in df.columns:
            df["credit"] = df.get("credit", 0).apply(_coerce_number)
            df["debit"] = df.get("debit", 0).apply(_coerce_number)
            signed_amount = df["credit"] - df["debit"]
        else:
            raise DocumentValidationError(
                "Bank statement requires either amount column or debit/credit columns."
            )
    else:
        signed_amount = df["amount"].apply(_coerce_number)

    normalized = pd.DataFrame(
        {
            "date": pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d"),
            "description": df["description"].fillna("").astype(str).str.strip(),
            "amount": signed_amount.astype(float).abs(),
            "txn_type": signed_amount.apply(lambda value: "income" if value >= 0 else "expense"),
            "category": df.apply(
                lambda row: row.get("category")
                if pd.notna(row.get("category"))
                else _infer_category(
                    str(row["description"]),
                    "sales" if row.name in signed_amount[signed_amount >= 0].index else "expense",
                ),
                axis=1,
            ),
            "gst_rate": df.get("gst_rate", 0).apply(_coerce_number) if "gst_rate" in df.columns else 0.0,
            "amount_inclusive_gst": df.get("amount_inclusive_gst", False).apply(_coerce_bool)
            if "amount_inclusive_gst" in df.columns
            else False,
            "vendor_state": df.get("vendor_state", "NA").fillna("NA") if "vendor_state" in df.columns else "NA",
            "business_state": df.get("business_state", "NA").fillna("NA")
            if "business_state" in df.columns
            else "NA",
            "eligible_itc": df.get("eligible_itc", False).apply(_coerce_bool)
            if "eligible_itc" in df.columns
            else False,
        }
    )

    normalized = normalized[normalized["date"].notna()]
    summary = {
        "rows": int(len(normalized)),
        "credits_detected": round(float(signed_amount[signed_amount >= 0].sum()), 2),
        "debits_detected": round(float(abs(signed_amount[signed_amount < 0].sum())), 2),
    }
    return ParsedDocument("bank_statement", source_name, normalized, summary)


def _parse_ais(df: pd.DataFrame, source_name: str) -> ParsedDocument:
    amount_column = "amount" if "amount" in df.columns else "gross_amount"
    tds_column = "tds" if "tds" in df.columns else None
    tcs_column = "tcs" if "tcs" in df.columns else None

    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        label = str(
            row.get("income_type")
            or row.get("section")
            or row.get("information_code")
            or row.get("description")
            or ""
        ).strip()
        normalized_label = label.lower()
        category = AIS_CATEGORY_MAP.get(normalized_label, "other_income")
        records.append(
            {
                "income_type": category,
                "description": str(row.get("description", label)).strip(),
                "amount": _coerce_number(row.get(amount_column, 0)),
                "tds": _coerce_number(row.get(tds_column, 0)) if tds_column else 0.0,
                "tcs": _coerce_number(row.get(tcs_column, 0)) if tcs_column else 0.0,
            }
        )

    normalized = pd.DataFrame(records)
    summary = {
        "rows": int(len(normalized)),
        "reported_income": round(float(normalized["amount"].sum()), 2),
        "reported_tds": round(float(normalized["tds"].sum()), 2),
        "reported_tcs": round(float(normalized["tcs"].sum()), 2),
    }
    return ParsedDocument("ais", source_name, normalized, summary)


def _parse_form16(df: pd.DataFrame, source_name: str) -> ParsedDocument:
    summary_style_columns = {"gross_salary", "taxable_salary", "tds", "reported_total_income"}
    if summary_style_columns & set(df.columns):
        first_row = df.iloc[0].to_dict()
        normalized = {
            "employer_name": str(first_row.get("employer_name", "")).strip(),
            "gross_salary": _coerce_number(first_row.get("gross_salary", 0)),
            "exempt_allowances": _coerce_number(first_row.get("exempt_allowances", 0)),
            "standard_deduction": _coerce_number(first_row.get("standard_deduction", 0)),
            "taxable_salary": _coerce_number(first_row.get("taxable_salary", 0)),
            "tds": _coerce_number(first_row.get("tds", 0)),
            "reported_total_income": _coerce_number(first_row.get("reported_total_income", 0)),
        }
        summary = {
            "employer_name": normalized["employer_name"],
            "gross_salary": round(float(normalized["gross_salary"]), 2),
            "tds": round(float(normalized["tds"]), 2),
        }
        return ParsedDocument("form16", source_name, normalized, summary)

    records: dict[str, float] = {}
    employer_name = ""

    for _, row in df.iterrows():
        component_raw = str(row.get("component", "")).strip().lower()
        key = FORM16_COMPONENT_MAP.get(component_raw, component_raw.replace(" ", "_"))
        records[key] = records.get(key, 0.0) + _coerce_number(row.get("amount", 0))
        if not employer_name and pd.notna(row.get("employer_name")):
            employer_name = str(row.get("employer_name")).strip()

    normalized = {
        "employer_name": employer_name,
        "gross_salary": records.get("gross_salary", 0.0)
        + records.get("perquisites", 0.0)
        + records.get("profits_in_lieu", 0.0),
        "exempt_allowances": records.get("exempt_allowances", 0.0),
        "standard_deduction": records.get("standard_deduction", 0.0),
        "taxable_salary": records.get("taxable_salary", 0.0),
        "tds": records.get("tds", 0.0),
        "reported_total_income": records.get("reported_total_income", 0.0),
    }
    summary = {
        "employer_name": employer_name,
        "gross_salary": round(float(normalized["gross_salary"]), 2),
        "tds": round(float(normalized["tds"]), 2),
    }
    return ParsedDocument("form16", source_name, normalized, summary)


def _parse_register(df: pd.DataFrame, source_name: str, document_type: str, txn_type: str) -> ParsedDocument:
    normalized = pd.DataFrame(
        {
            "date": pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d"),
            "description": df["description"].fillna("").astype(str).str.strip(),
            "amount": df["amount"].apply(_coerce_number).abs(),
            "txn_type": txn_type,
            "category": df["category"].fillna("sales" if txn_type == "income" else "purchase")
            if "category" in df.columns
            else ("sales" if txn_type == "income" else "purchase"),
            "gst_rate": df.get("gst_rate", 0).apply(_coerce_number) if "gst_rate" in df.columns else 0.0,
            "amount_inclusive_gst": df.get("amount_inclusive_gst", False).apply(_coerce_bool)
            if "amount_inclusive_gst" in df.columns
            else False,
            "vendor_state": df.get("vendor_state", "NA").fillna("NA") if "vendor_state" in df.columns else "NA",
            "business_state": df.get("business_state", "NA").fillna("NA")
            if "business_state" in df.columns
            else "NA",
            "eligible_itc": df.get("eligible_itc", txn_type == "expense").apply(_coerce_bool)
            if "eligible_itc" in df.columns
            else (txn_type == "expense"),
        }
    )
    normalized = normalized[normalized["date"].notna()]
    summary = {
        "rows": int(len(normalized)),
        "gross_amount": round(float(normalized["amount"].sum()), 2),
    }
    return ParsedDocument(document_type, source_name, normalized, summary)


def _parse_capital_gains_statement(df: pd.DataFrame, source_name: str) -> ParsedDocument:
    sale_value = df["sale_value"].apply(_coerce_number) if "sale_value" in df.columns else df["amount"].apply(_coerce_number)
    cost = df["cost_of_acquisition"].apply(_coerce_number) if "cost_of_acquisition" in df.columns else 0.0
    net_gain = (
        df["net_gain"].apply(_coerce_number)
        if "net_gain" in df.columns
        else (sale_value - cost)
    )
    normalized = {
        "assets": [
            {
                "asset_name": str(row.get("asset_name") or row.get("description") or "").strip(),
                "sale_value": round(_coerce_number(row.get("sale_value", row.get("amount", 0.0))), 2),
                "cost_of_acquisition": round(_coerce_number(row.get("cost_of_acquisition", 0.0)), 2),
                "net_gain": round(
                    _coerce_number(row.get("net_gain", _coerce_number(row.get("sale_value", row.get("amount", 0.0))) - _coerce_number(row.get("cost_of_acquisition", 0.0)))),
                    2,
                ),
            }
            for _, row in df.iterrows()
        ],
        "net_gain": round(float(net_gain.sum()), 2),
    }
    summary = {
        "rows": int(len(df)),
        "net_gain": normalized["net_gain"],
    }
    return ParsedDocument("capital_gains_statement", source_name, normalized, summary)


def _parse_interest_certificate(df: pd.DataFrame, source_name: str) -> ParsedDocument:
    interest_income = (
        df["interest_income"].apply(_coerce_number)
        if "interest_income" in df.columns
        else df["amount"].apply(_coerce_number)
    )
    normalized = {
        "issuer_name": str(df.iloc[0].get("issuer_name") or df.iloc[0].get("description") or "").strip(),
        "interest_income": round(float(interest_income.sum()), 2),
        "tds": round(float(df.get("tds", 0).apply(_coerce_number).sum()) if "tds" in df.columns else 0.0, 2),
    }
    summary = {
        "issuer_name": normalized["issuer_name"],
        "interest_income": normalized["interest_income"],
        "tds": normalized["tds"],
    }
    return ParsedDocument("interest_certificate", source_name, normalized, summary)


def _parse_rent_summary(df: pd.DataFrame, source_name: str) -> ParsedDocument:
    annual_rent = (
        df["annual_rent_received"].apply(_coerce_number)
        if "annual_rent_received" in df.columns
        else df["amount"].apply(_coerce_number)
    )
    normalized = {
        "tenant_name": str(df.iloc[0].get("tenant_name") or df.iloc[0].get("description") or "").strip(),
        "annual_rent_received": round(float(annual_rent.sum()), 2),
        "municipal_taxes": round(float(df.get("municipal_taxes", 0).apply(_coerce_number).sum()) if "municipal_taxes" in df.columns else 0.0, 2),
        "interest_on_housing_loan": round(float(df.get("interest_on_housing_loan", 0).apply(_coerce_number).sum()) if "interest_on_housing_loan" in df.columns else 0.0, 2),
    }
    summary = {
        "tenant_name": normalized["tenant_name"],
        "annual_rent_received": normalized["annual_rent_received"],
    }
    return ParsedDocument("rent_summary", source_name, normalized, summary)


def _parse_deduction_proof(df: pd.DataFrame, source_name: str) -> ParsedDocument:
    deductions: dict[str, float] = {}
    for _, row in df.iterrows():
        section = str(row.get("section") or row.get("component") or "").strip().lower()
        if not section:
            continue
        deductions[section] = round(deductions.get(section, 0.0) + _coerce_number(row.get("amount", row.get("value", 0.0))), 2)

    normalized = {
        "deductions": deductions,
    }
    summary = {
        "sections": list(deductions.keys()),
        "total_amount": round(sum(deductions.values()), 2),
    }
    return ParsedDocument("deduction_proof", source_name, normalized, summary)


def parse_document(document_type: str, csv_content: str, source_name: str = "uploaded.csv") -> ParsedDocument:
    if document_type not in SUPPORTED_DOCUMENTS:
        raise DocumentValidationError(f"Unsupported document type: {document_type}")

    df = _normalize_columns(_load_csv(csv_content))
    requirements = SUPPORTED_DOCUMENTS[document_type]["required_any_of"]
    if not _has_required_columns(df, requirements):
        raise DocumentValidationError(
            f"{document_type} CSV is missing required columns. Received columns: {list(df.columns)}"
        )

    if document_type == "bank_statement":
        return _parse_bank_statement(df, source_name)
    if document_type == "ais":
        return _parse_ais(df, source_name)
    if document_type == "form16":
        return _parse_form16(df, source_name)
    if document_type == "sales_register":
        return _parse_register(df, source_name, document_type, "income")
    if document_type == "purchase_register":
        return _parse_register(df, source_name, document_type, "expense")
    if document_type == "capital_gains_statement":
        return _parse_capital_gains_statement(df, source_name)
    if document_type == "interest_certificate":
        return _parse_interest_certificate(df, source_name)
    if document_type == "rent_summary":
        return _parse_rent_summary(df, source_name)
    if document_type == "deduction_proof":
        return _parse_deduction_proof(df, source_name)

    raise DocumentValidationError(f"Parser not implemented for {document_type}")
