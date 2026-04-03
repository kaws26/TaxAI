from __future__ import annotations

import json
from typing import Any
from urllib import error, request

try:
    from groq import Groq
except ImportError:  # pragma: no cover
    Groq = None

from runtime import get_runtime_config


ALLOWED_BANK_INCOME_LABELS = {
    "salary",
    "interest",
    "rent",
    "professional_receipts",
    "sales",
    "dividend",
    "capital_gains",
    "tax_refund",
    "transfer",
    "other_income",
    "unknown",
}


def groq_status() -> dict[str, Any]:
    config = get_runtime_config()
    api_key = str(getattr(config, "GROQ_API_KEY", "")).strip()
    enabled = bool(getattr(config, "GROQ_ENABLED", False))
    return {
        "enabled": enabled,
        "has_api_key": bool(api_key),
        "sdk_installed": Groq is not None,
        "transport": "sdk" if Groq is not None else "http",
        "model": getattr(config, "GROQ_MODEL", None),
    }


def groq_available() -> bool:
    status = groq_status()
    return bool(status["enabled"] and status["has_api_key"])


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("LLM response did not contain a JSON object.")
    return json.loads(text[start : end + 1])


def _sdk_completion(messages: list[dict[str, str]]) -> str:
    config = get_runtime_config()
    client = Groq(api_key=config.GROQ_API_KEY)
    completion = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=messages,
        temperature=0,
        max_completion_tokens=config.GROQ_MAX_COMPLETION_TOKENS,
        top_p=1,
        reasoning_effort=config.GROQ_REASONING_EFFORT,
        stream=False,
        stop=None,
    )
    return completion.choices[0].message.content or "{}"


def _http_completion(messages: list[dict[str, str]]) -> str:
    config = get_runtime_config()
    payload = {
        "model": config.GROQ_MODEL,
        "messages": messages,
        "temperature": 0,
        "max_completion_tokens": config.GROQ_MAX_COMPLETION_TOKENS,
        "top_p": 1,
        "reasoning_effort": config.GROQ_REASONING_EFFORT,
        "stream": False,
    }
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        config.GROQ_API_BASE_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {config.GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8")
    parsed = json.loads(raw)
    return parsed.get("choices", [{}])[0].get("message", {}).get("content", "{}")


def _request_completion(messages: list[dict[str, str]]) -> tuple[str | None, dict[str, Any]]:
    try:
        if Groq is not None:
            return _sdk_completion(messages), {"transport": "sdk"}
        return _http_completion(messages), {"transport": "http"}
    except error.HTTPError as exc:  # pragma: no cover
        detail = exc.read().decode("utf-8", errors="ignore")
        return None, {"transport": "http", "error": f"http_{exc.code}", "detail": detail[:240]}
    except Exception as exc:  # pragma: no cover
        return None, {"transport": "sdk" if Groq is not None else "http", "error": type(exc).__name__, "detail": str(exc)[:240]}


def classify_bank_income_rows(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not groq_available() or not rows:
        return None

    config = get_runtime_config()
    prompt_rows = [
        {
            "row_id": row["row_id"],
            "date": row.get("date"),
            "description": str(row.get("description", ""))[:120],
            "amount": row.get("amount", 0.0),
        }
        for row in rows[: config.GROQ_BANK_ROWS_PER_CALL]
    ]
    messages = [
        {
            "role": "system",
            "content": "You are a precise Indian tax transaction classification engine. Respond with valid JSON only.",
        },
        {
            "role": "user",
            "content": (
                "Classify bank-statement income rows for Indian income-tax preparation.\n"
                "Return strict JSON: "
                '{"classifications":[{"row_id":"...","label":"salary|interest|rent|professional_receipts|sales|dividend|capital_gains|tax_refund|transfer|other_income|unknown","confidence":0.0,"reason":"short"}]}\n'
                "Use transfer for self-transfer/internal movement, unknown if unclear, and keep reason under 12 words.\n"
                f"Rows: {json.dumps(prompt_rows, separators=(',', ':'))}"
            ),
        },
    ]

    content, meta = _request_completion(messages)
    if not content:
        return {
            "classifications": [],
            "model": config.GROQ_MODEL,
            "rows_sent": len(prompt_rows),
            "meta": {**groq_status(), **meta, "success": False},
        }

    try:
        payload = _extract_json_object(content)
    except Exception as exc:  # pragma: no cover
        return {
            "classifications": [],
            "model": config.GROQ_MODEL,
            "rows_sent": len(prompt_rows),
            "meta": {**groq_status(), **meta, "success": False, "error": type(exc).__name__, "detail": str(exc)[:240]},
        }

    valid_classifications: list[dict[str, Any]] = []
    for item in payload.get("classifications", []):
        label = str(item.get("label", "unknown")).strip()
        if label not in ALLOWED_BANK_INCOME_LABELS:
            label = "unknown"
        valid_classifications.append(
            {
                "row_id": str(item.get("row_id", "")),
                "label": label,
                "confidence": round(float(item.get("confidence", 0.0) or 0.0), 3),
                "reason": str(item.get("reason", "")).strip()[:80],
            }
        )

    return {
        "classifications": valid_classifications,
        "model": config.GROQ_MODEL,
        "rows_sent": len(prompt_rows),
        "meta": {**groq_status(), **meta, "success": True},
    }


def extract_csv_from_ocr_text(
    *,
    document_type: str,
    required_any_of: list[list[str]],
    optional: list[str],
    ocr_text: str,
) -> dict[str, Any] | None:
    if not groq_available() or not ocr_text.strip():
        return None

    config = get_runtime_config()
    max_chars = int(getattr(config, "GROQ_OCR_MAX_INPUT_CHARS", 12000))
    trimmed_text = ocr_text.strip()[:max_chars]
    messages = [
        {
            "role": "system",
            "content": (
                "You convert OCR-extracted Indian financial document text into strict CSV. "
                "Return valid JSON only with keys csv_content, detected_columns, confidence, notes."
            ),
        },
        {
            "role": "user",
            "content": (
                "Convert this OCR text into one CSV that best matches the requested document type.\n"
                f"Document type: {document_type}\n"
                f"Required-any-of groups: {json.dumps(required_any_of)}\n"
                f"Optional columns: {json.dumps(optional)}\n"
                "Rules:\n"
                "1) First row must be CSV headers.\n"
                "2) Use snake_case headers.\n"
                "3) Use only columns relevant to the document.\n"
                "4) Include numeric values without currency symbols.\n"
                "5) If uncertain, keep conservative rows only.\n"
                "6) Return JSON only in this format:\n"
                '{"csv_content":"header1,header2\\nvalue1,value2","detected_columns":["header1","header2"],"confidence":0.0,"notes":"short"}\n\n'
                f"OCR text:\n{trimmed_text}"
            ),
        },
    ]

    content, meta = _request_completion(messages)
    if not content:
        return {
            "csv_content": "",
            "detected_columns": [],
            "confidence": 0.0,
            "notes": "",
            "meta": {**groq_status(), **meta, "success": False},
        }

    try:
        payload = _extract_json_object(content)
    except Exception as exc:  # pragma: no cover
        return {
            "csv_content": "",
            "detected_columns": [],
            "confidence": 0.0,
            "notes": "",
            "meta": {**groq_status(), **meta, "success": False, "error": type(exc).__name__, "detail": str(exc)[:240]},
        }

    csv_content = str(payload.get("csv_content", "")).strip()
    detected_columns = payload.get("detected_columns", [])
    if not isinstance(detected_columns, list):
        detected_columns = []

    return {
        "csv_content": csv_content,
        "detected_columns": [str(column).strip() for column in detected_columns if str(column).strip()],
        "confidence": round(float(payload.get("confidence", 0.0) or 0.0), 3),
        "notes": str(payload.get("notes", "")).strip()[:180],
        "meta": {**groq_status(), **meta, "success": True},
    }


def answer_tax_question_with_groq(*, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
    if not groq_available():
        return None

    config = get_runtime_config()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    content, meta = _request_completion(messages)
    if not content:
        return {
            "answer": "",
            "model": config.GROQ_MODEL,
            "meta": {**groq_status(), **meta, "success": False},
        }

    return {
        "answer": str(content).strip(),
        "model": config.GROQ_MODEL,
        "meta": {**groq_status(), **meta, "success": True},
    }
