from services.tax_rules.individual_fy_2024_25 import compute_tax_for_fy_2024_25


def compute_tax_by_financial_year(financial_year: str, **kwargs):
    if financial_year == "2024-25":
        return compute_tax_for_fy_2024_25(financial_year=financial_year, **kwargs)
    return compute_tax_for_fy_2024_25(financial_year=financial_year, **kwargs)
