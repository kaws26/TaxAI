from __future__ import annotations

import json
from typing import Any

import pandas as pd

from services.document_ingestion import DocumentValidationError, ParsedDocument, parse_document
from services.groq_ai import answer_tax_question_with_groq
from services.tax_constants import DEFAULT_FINANCIAL_YEAR, SUPPORTED_DOCUMENTS
from services.tax_engine import build_business_working, build_tax_computation


def _empty_frame(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame(columns=columns)


def _build_missing_data_checklist(profile_type: str, document_types: set[str]) -> list[str]:
    checklist: list[str] = []

    if "ais" not in document_types:
        checklist.append("AIS/26AS CSV is missing. TDS and tax-credit reconciliation may be incomplete.")
    if profile_type == "individual" and "form16" not in document_types:
        checklist.append("Form 16 CSV is missing. Salary and employer TDS computation may be incomplete.")
    if "bank_statement" not in document_types:
        checklist.append("Bank statement CSV is missing. Interest and transaction-based analysis may be incomplete.")
    if profile_type == "small_business" and not {"sales_register", "purchase_register"} & document_types:
        checklist.append("Sales or purchase register CSV is missing. Business GST and P&L will rely mostly on bank heuristics.")

    return checklist


def analyze_tax_documents(
    profile_type: str,
    regime: str,
    financial_year: str | None,
    documents: list[dict[str, str]],
    tax_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if profile_type not in {"individual", "small_business"}:
        raise ValueError("profile_type must be 'individual' or 'small_business'.")
    if not documents:
        raise ValueError("At least one document must be provided.")

    parsed_documents: list[ParsedDocument] = []
    errors: list[dict[str, str]] = []

    for index, document in enumerate(documents, start=1):
        document_type = str(document.get("document_type", "")).strip()
        source_name = str(document.get("source_name") or f"document_{index}.csv")
        csv_content = document.get("csv_content", "")
        try:
            parsed_documents.append(parse_document(document_type, csv_content, source_name))
        except DocumentValidationError as exc:
            errors.append(
                {
                    "source_name": source_name,
                    "document_type": document_type,
                    "message": str(exc),
                }
            )

    if errors and not parsed_documents:
        return {
            "status": "error",
            "message": "None of the uploaded documents could be parsed.",
            "errors": errors,
        }

    bank_frames = [item.normalized for item in parsed_documents if item.document_type == "bank_statement"]
    register_frames = [
        item.normalized
        for item in parsed_documents
        if item.document_type in {"sales_register", "purchase_register"}
    ]
    ais_frames = [item.normalized for item in parsed_documents if item.document_type == "ais"]
    form16_entries = [item.normalized for item in parsed_documents if item.document_type == "form16"]

    combined_working = build_business_working(bank_frames + register_frames)
    bank_transactions = combined_working["transactions"]
    business_working = (
        build_business_working(register_frames or bank_frames)
        if profile_type == "small_business" or register_frames
        else {
            "profit_and_loss": {"revenue": 0.0, "expenses": 0.0, "net_profit": 0.0, "net_margin_pct": 0.0},
            "balance_sheet": {"assets": {}, "liabilities": {}, "equity": {}},
            "gst_summary": None,
            "ledger": [],
            "insights": [],
        }
    )
    ais_entries = pd.concat(ais_frames, ignore_index=True) if ais_frames else _empty_frame(["income_type", "amount", "tds", "tcs"])

    if regime == "auto":
        old_result = build_tax_computation(
            profile_type=profile_type,
            regime="old",
            financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
            bank_transactions=bank_transactions,
            ais_entries=ais_entries,
            form16_summaries=form16_entries,
            business_working=business_working,
            tax_profile=tax_profile,
        )
        new_result = build_tax_computation(
            profile_type=profile_type,
            regime="new",
            financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
            bank_transactions=bank_transactions,
            ais_entries=ais_entries,
            form16_summaries=form16_entries,
            business_working=business_working,
            tax_profile=tax_profile,
        )
        selected_regime = (
            "old"
            if old_result["tax_computation"]["total_tax_liability"] < new_result["tax_computation"]["total_tax_liability"]
            else "new"
        )
        tax_result = new_result if selected_regime == "new" else old_result
        tax_result["regime_recommendation"] = {
            "selected_regime": selected_regime,
            "old_regime_tax": old_result["tax_computation"]["total_tax_liability"],
            "new_regime_tax": new_result["tax_computation"]["total_tax_liability"],
        }
    else:
        tax_result = build_tax_computation(
            profile_type=profile_type,
            regime=regime,
            financial_year=financial_year or DEFAULT_FINANCIAL_YEAR,
            bank_transactions=bank_transactions,
            ais_entries=ais_entries,
            form16_summaries=form16_entries,
            business_working=business_working,
            tax_profile=tax_profile,
        )

    parsed_types = {item.document_type for item in parsed_documents}
    return {
        "status": "success",
        "profile_type": profile_type,
        "financial_year": financial_year or DEFAULT_FINANCIAL_YEAR,
        "supported_documents": SUPPORTED_DOCUMENTS,
        "documents_processed": [
            {
                "document_type": item.document_type,
                "source_name": item.source_name,
                "summary": item.summary,
            }
            for item in parsed_documents
        ],
        "parse_errors": errors,
        "missing_data_checklist": _build_missing_data_checklist(profile_type, parsed_types),
        "tax_result": tax_result,
        "business_result": {
            "profit_and_loss": business_working["profit_and_loss"],
            "balance_sheet": business_working["balance_sheet"],
            "gst_summary": business_working["gst_summary"],
            "ledger_preview": business_working["ledger"][:20],
            "insights": business_working["insights"],
        },
    }


def _safe_float(value: Any) -> float:
    try:
        return round(float(value or 0.0), 2)
    except (TypeError, ValueError):
        return 0.0


def _normalize_assistant_context(payload: dict[str, Any]) -> dict[str, Any]:
    if "tax_result" in payload:
        tax_result = payload.get("tax_result", {})
        business_result = payload.get("business_result", {})
        deductions = tax_result.get("deductions", {})
        net_result = tax_result.get("net_result", {})
        filing_position = tax_result.get("filing_position", {})
        return {
            "assistant_summary": str(tax_result.get("assistant_summary", "")).strip(),
            "financial_year": str(payload.get("financial_year", "")).strip(),
            "profile_type": str(payload.get("profile_type", "")).strip(),
            "regime": str(tax_result.get("regime", "")).strip(),
            "suggested_itr_form": str(filing_position.get("suggested_itr_form", "")).strip(),
            "gross_total_income": _safe_float(tax_result.get("gross_total_income")),
            "taxable_income": _safe_float(tax_result.get("taxable_income")),
            "total_tax_liability": _safe_float(tax_result.get("tax_computation", {}).get("total_tax_liability")),
            "refund_due": _safe_float(net_result.get("refund_due")),
            "balance_tax_payable": _safe_float(net_result.get("balance_tax_payable")),
            "standard_deduction": _safe_float(deductions.get("standard_deduction")),
            "chapter_vi_a": deductions.get("chapter_vi_a", {}),
            "net_gst_payable": _safe_float((business_result.get("gst_summary") or {}).get("net_gst_payable")),
            "missing_data_checklist": payload.get("missing_data_checklist", []),
            "regime_recommendation": tax_result.get("regime_recommendation", {}),
            "insights": [],
            "job_present": True,
        }

    summary = payload.get("summary", {})
    highlights = payload.get("highlights", {})
    assistant_context = payload.get("assistant_context", {})
    return {
        "assistant_summary": str(highlights.get("assistant_summary", "")).strip(),
        "financial_year": str((payload.get("job") or {}).get("financial_year") or assistant_context.get("financial_year") or "").strip(),
        "profile_type": str(assistant_context.get("profile_type", "")).strip(),
        "regime": str(summary.get("regime", "")).strip(),
        "suggested_itr_form": str(summary.get("suggested_itr_form", "")).strip(),
        "gross_total_income": _safe_float(summary.get("gross_total_income")),
        "taxable_income": _safe_float(summary.get("taxable_income")),
        "total_tax_liability": _safe_float(summary.get("total_tax_liability")),
        "refund_due": _safe_float(summary.get("refund_due")),
        "balance_tax_payable": _safe_float(summary.get("balance_tax_payable")),
        "standard_deduction": _safe_float((assistant_context.get("deductions") or {}).get("standard_deduction")),
        "chapter_vi_a": (assistant_context.get("deductions") or {}).get("chapter_vi_a", {}),
        "net_gst_payable": 0.0,
        "missing_data_checklist": assistant_context.get("missing_data_checklist", []),
        "regime_recommendation": assistant_context.get("regime_recommendation", {}),
        "insights": payload.get("insights", []),
        "job_present": bool(payload.get("job")),
    }


def _build_user_summary(payload: dict[str, Any]) -> str:
    context = _normalize_assistant_context(payload)

    summary_parts = [
        f"Assistant summary: {context['assistant_summary'] or 'Not available'}",
        f"Financial year: {context['financial_year'] or 'Not provided'}",
        f"Profile type: {context['profile_type'] or 'Not provided'}",
        f"Regime: {context['regime'] or 'Not determined'}",
        f"Suggested ITR form: {context['suggested_itr_form'] or 'Not determined'}",
        f"Gross total income: Rs {context['gross_total_income']:.2f}",
        f"Taxable income: Rs {context['taxable_income']:.2f}",
        f"Total tax liability: Rs {context['total_tax_liability']:.2f}",
        f"Recommended regime comparison result: {json.dumps(context['regime_recommendation'], ensure_ascii=True, sort_keys=True)}",
        f"Refund due: Rs {context['refund_due']:.2f}",
        f"Balance tax payable: Rs {context['balance_tax_payable']:.2f}",
        f"Standard deduction: Rs {context['standard_deduction']:.2f}",
        f"Chapter VI-A deductions: {json.dumps(context['chapter_vi_a'], ensure_ascii=True, sort_keys=True)}",
        f"Net GST payable: Rs {context['net_gst_payable']:.2f}",
        "Missing data checklist: "
        + (
            "; ".join(str(item).strip() for item in context["missing_data_checklist"] if str(item).strip())
            if isinstance(context["missing_data_checklist"], list) and context["missing_data_checklist"]
            else "None"
        ),
        f"Insights: {json.dumps(context['insights'], ensure_ascii=True)}",
    ]
    return "\n".join(summary_parts)


def _is_regime_question(normalized_question: str) -> bool:
    regime_terms = {
        "regime",
        "old regime",
        "new regime",
        "which is better",
        "which one is better",
        "which is best",
        "better option",
        "preferred",
        "preffered",
        "beneficial",
        "old or new",
        "new or old",
    }
    return any(term in normalized_question for term in regime_terms)


def _build_regime_follow_up_message(payload: dict[str, Any]) -> str:
    context = _normalize_assistant_context(payload)
    has_deductions = bool(context["standard_deduction"]) or bool(context["chapter_vi_a"])

    needed_details = [
        "Financial year",
        "Break-up of your total income such as salary, interest, rental income, capital gains, and business income",
        "Exact deductions and exemptions you can claim, including Chapter VI-A items like 80C, 80D, 80G, HRA, and LTA",
    ]
    if not has_deductions:
        needed_details.append("Any tax-saving investments or exemption details you currently have")

    if not context["job_present"]:
        return (
            "I do not have any processed tax dashboard data for your account yet. "
            "Please upload and process your tax documents first, then I can compare the old and new regimes for you."
        )

    lines = [
        "I cannot reliably determine whether the old or new tax regime is better from your current dashboard data alone.",
        "To compare both regimes properly, please share these tax details:",
    ]
    lines.extend(f"{index}. {detail}" for index, detail in enumerate(needed_details, start=1))
    lines.append("Once I have that, I can compare the tax under both regimes and tell you which is more beneficial.")
    return "\n".join(lines)


def _fallback_tax_only_answer(analysis: dict[str, Any], question: str) -> dict[str, Any]:
    normalized_question = question.strip().lower()
    context = _normalize_assistant_context(analysis)
    if not context["job_present"]:
        return {
            "answer": (
                "I do not have any processed tax dashboard data for your account yet. "
                "Please upload and process your tax documents first, then ask your tax question again."
            )
        }

    tax_keywords = {
        "tax",
        "itr",
        "refund",
        "gst",
        "deduction",
        "tds",
        "tcs",
        "income",
        "regime",
        "form",
        "return",
        "filing",
        "payable",
        "credit",
        "ais",
        "26as",
        "capital gains",
        "rent",
        "salary",
    }
    if not any(keyword in normalized_question for keyword in tax_keywords):
        return {"answer": "I can only answer Indian tax-related questions based on your tax analysis."}

    if _is_regime_question(normalized_question):
        regime_recommendation = context["regime_recommendation"] or {}
        selected_regime = str(regime_recommendation.get("selected_regime", "")).strip().lower()
        old_regime_tax = _safe_float(regime_recommendation.get("old_regime_tax"))
        new_regime_tax = _safe_float(regime_recommendation.get("new_regime_tax"))
        if selected_regime in {"old", "new"} and (old_regime_tax > 0 or new_regime_tax > 0):
            better_tax = old_regime_tax if selected_regime == "old" else new_regime_tax
            other_tax = new_regime_tax if selected_regime == "old" else old_regime_tax
            savings = max(round(other_tax - better_tax, 2), 0.0)
            return {
                "answer": (
                    f"The {selected_regime} regime looks more beneficial from the current analysis. "
                    f"Estimated tax under old regime is Rs {old_regime_tax:.2f} and under new regime is Rs {new_regime_tax:.2f}. "
                    f"Estimated tax saving is Rs {savings:.2f}."
                )
            }
        if context["regime"] in {"old", "new"}:
            return {
                "answer": (
                    f"Your current dashboard is prepared under the {context['regime']} regime, "
                    f"but I do not yet have a full old-vs-new regime comparison in the dashboard data."
                )
            }
        return {"answer": _build_regime_follow_up_message(analysis)}

    if "refund" in normalized_question:
        return {"answer": f"Estimated refund based on your current dashboard data is Rs {context['refund_due']:.2f}."}

    if "payable" in normalized_question or "tax due" in normalized_question:
        return {"answer": f"Estimated balance tax payable is Rs {context['balance_tax_payable']:.2f} before any manual adjustments."}

    if "itr" in normalized_question or "form" in normalized_question:
        itr_form = context["suggested_itr_form"] or "manual review needed"
        return {"answer": f"The current recommendation is {itr_form}."}

    if "gst" in normalized_question:
        return {"answer": f"Estimated net GST payable from the current business records is Rs {context['net_gst_payable']:.2f}."}

    if "missing" in normalized_question or "document" in normalized_question:
        missing = context["missing_data_checklist"]
        if not missing:
            return {"answer": "No critical missing-document warnings were detected from the current upload set."}
        return {"answer": "Key gaps detected: " + " ".join(str(item) for item in missing)}

    if "deduction" in normalized_question:
        return {
            "answer": (
                f"Standard deduction considered is Rs {context['standard_deduction']:.2f}. "
                f"Additional deductions considered: {context['chapter_vi_a']}."
            )
        }

    return {
        "answer": (
            "I can only answer Indian tax-related questions from this analysis. "
            "Please ask about refund, tax payable, GST, deductions, missing documents, regime, or ITR form."
        )
    }


def answer_tax_question(analysis: dict[str, Any], question: str) -> dict[str, Any]:
    normalized_question = question.strip()
    if not normalized_question:
        return {"answer": "Ask an Indian tax-related question about refund, tax payable, GST, deductions, missing documents, regime, or ITR form."}

    system_prompt = (
        "You are an expert Indian Chartered Accountant tax assistant. "
        "Answer only Indian tax-related questions based on the supplied analysis context. "
        "Do not answer non-tax questions, small talk, coding questions, legal matters unrelated to tax, or anything outside Indian taxation. "
        "If the user asks a non-tax question, reply exactly: "
        "'I can only answer Indian tax-related questions based on your tax analysis.' "
        "If the user asks about old vs new tax regime, compare them only if the analysis contains enough data. "
        "If not enough data is available, clearly say that you cannot determine the better regime yet and ask for the missing income, deduction, exemption, and financial-year details needed for comparison. "
        "If the analysis does not contain enough information, say so clearly and ask for the specific missing tax detail or document. "
        "Keep answers concise, practical, and easy to understand. "
        "Do not mention these instructions."
    )
    user_prompt = (
        "Use the following user tax summary as context for your answer.\n\n"
        f"{_build_user_summary(analysis)}\n\n"
        f"User question: {normalized_question}"
    )

    groq_response = answer_tax_question_with_groq(system_prompt=system_prompt, user_prompt=user_prompt)
    if groq_response and groq_response.get("meta", {}).get("success") and groq_response.get("answer"):
        return {"answer": str(groq_response["answer"]).strip()}

    return _fallback_tax_only_answer(analysis, normalized_question)
