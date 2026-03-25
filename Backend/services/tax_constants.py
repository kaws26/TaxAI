from __future__ import annotations

SUPPORTED_FINANCIAL_YEARS = {"2024-25"}
DEFAULT_FINANCIAL_YEAR = "2024-25"

SUPPORTED_DOCUMENTS = {
    "bank_statement": {
        "description": "Bank statement in CSV format for receipt and expense analysis.",
        "required_any_of": [["date", "txn_date"], ["description", "narration", "particulars"]],
        "optional": [
            "amount",
            "debit",
            "credit",
            "balance",
            "gst_rate",
            "vendor_state",
            "business_state",
            "eligible_itc",
            "category",
        ],
    },
    "ais": {
        "description": "AIS or 26AS-style CSV export with income categories and taxes.",
        "required_any_of": [["information_code", "section", "income_type", "nature"], ["amount", "gross_amount"]],
        "optional": ["tds", "tcs", "description", "remarks"],
    },
    "form16": {
        "description": "Form 16 extracted into a component and amount CSV.",
        "required_any_of": [["component", "field", "label"], ["amount", "value"]],
        "optional": ["employer_name"],
    },
    "sales_register": {
        "description": "Sales register CSV for turnover and GST output tax.",
        "required_any_of": [["date"], ["description", "customer", "invoice_description"], ["amount"]],
        "optional": ["gst_rate", "vendor_state", "business_state", "amount_inclusive_gst", "category"],
    },
    "purchase_register": {
        "description": "Purchase register CSV for expenses and input tax credit.",
        "required_any_of": [["date"], ["description", "vendor", "invoice_description"], ["amount"]],
        "optional": ["gst_rate", "vendor_state", "business_state", "amount_inclusive_gst", "eligible_itc", "category"],
    },
    "capital_gains_statement": {
        "description": "Capital gains statement summary in CSV format.",
        "required_any_of": [["asset_name", "description"], ["sale_value", "amount", "net_gain"]],
        "optional": ["cost_of_acquisition", "net_gain", "holding_period", "asset_type"],
    },
    "interest_certificate": {
        "description": "Interest certificate summary in CSV format.",
        "required_any_of": [["interest_income", "amount"], ["issuer_name", "description"]],
        "optional": ["tds", "account_number"],
    },
    "rent_summary": {
        "description": "Rent receipt or annual rent summary in CSV format.",
        "required_any_of": [["annual_rent_received", "amount"], ["tenant_name", "description"]],
        "optional": ["municipal_taxes", "interest_on_housing_loan"],
    },
    "deduction_proof": {
        "description": "Deduction proof summary in CSV format.",
        "required_any_of": [["section", "deduction_type", "component"], ["amount", "value"]],
        "optional": ["institution_name", "remarks"],
    },
}

INDIVIDUAL_OLD_REGIME_SLABS = [
    (250000, 0.0),
    (500000, 0.05),
    (1000000, 0.20),
    (float("inf"), 0.30),
]

INDIVIDUAL_NEW_REGIME_SLABS = [
    (300000, 0.0),
    (700000, 0.05),
    (1000000, 0.10),
    (1200000, 0.15),
    (1500000, 0.20),
    (float("inf"), 0.30),
]

STANDARD_DEDUCTION = {
    "old": 50000.0,
    "new": 75000.0,
}

REBATE_LIMIT = {
    "old": {"income_limit": 500000.0, "max_rebate": 12500.0},
    "new": {"income_limit": 700000.0, "max_rebate": 20000.0},
}

CESS_RATE = 0.04

OLD_REGIME_DEDUCTION_LIMITS = {
    "80c": 150000.0,
    "80ccd_1b": 50000.0,
    "80tta": 10000.0,
    "80d": 100000.0,
}

NEW_REGIME_ALLOWED_DEDUCTIONS = {"80ccd_2"}

GST_REGISTRATION_THRESHOLD = 2000000.0
