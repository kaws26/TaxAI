from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


PAGE_SIZE = (1240, 1754)
MARGIN_X = 72
CONTENT_WIDTH = PAGE_SIZE[0] - (MARGIN_X * 2)

PAPER = "#F5F3ED"
PAPER_ALT = "#EFE8DD"
CARD = "#FFFDFC"
BORDER = "#E0DDD6"
TEXT = "#1A1816"
TEXT_SOFT = "#5A5550"
MUTED = "#8A867F"
GOLD = "#C9A961"
GOLD_DARK = "#A88943"
BROWN = "#6E4B2A"
GREEN = "#2D5A3A"
RED = "#D4534F"
SAND = "#E8D6B5"


def _font(size: int, bold: bool = False, serif: bool = False):
    if serif and bold:
        candidates = ["DejaVuSerif-Bold.ttf", "Georgia Bold.ttf", "timesbd.ttf"]
    elif serif:
        candidates = ["DejaVuSerif.ttf", "Georgia.ttf", "times.ttf"]
    elif bold:
        candidates = ["DejaVuSans-Bold.ttf", "arialbd.ttf"]
    else:
        candidates = ["DejaVuSans.ttf", "arial.ttf"]

    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _money(value: Any) -> str:
    try:
        return f"Rs {float(value):,.2f}"
    except (TypeError, ValueError):
        return f"Rs {value}"


def _safe_float(value: Any) -> float:
    try:
        return round(float(value or 0.0), 2)
    except (TypeError, ValueError):
        return 0.0


def _labelize(key: str) -> str:
    return str(key).replace("_", " ").title()


def _draw_rounded_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str = CARD, outline: str = BORDER, radius: int = 26) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)


def _text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = str(text or "").split()
    if not words:
        return []

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        tentative = f"{current} {word}"
        if _text_size(draw, tentative, font)[0] <= max_width:
            current = tentative
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    x: int,
    y: int,
    max_width: int,
    font: ImageFont.ImageFont,
    fill: str,
    line_gap: int = 10,
) -> int:
    lines = _wrap_text(draw, text, font, max_width)
    _, line_height = _text_size(draw, "Ag", font)
    cursor_y = y
    for line in lines:
        draw.text((x, cursor_y), line, font=font, fill=fill)
        cursor_y += line_height + line_gap
    return cursor_y


def _fit_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> str:
    value = str(text or "")
    if _text_size(draw, value, font)[0] <= max_width:
        return value
    ellipsis = "..."
    if _text_size(draw, ellipsis, font)[0] > max_width:
        return ""
    trimmed = value
    while trimmed:
        candidate = trimmed + ellipsis
        if _text_size(draw, candidate, font)[0] <= max_width:
            return candidate
        trimmed = trimmed[:-1]
    return ellipsis


def _draw_header_band(draw: ImageDraw.ImageDraw, title: str, subtitle: str) -> None:
    title_font = _font(58, bold=True, serif=True)
    subtitle_font = _font(24)
    draw.rectangle((0, 0, PAGE_SIZE[0], 260), fill=BROWN)
    draw.ellipse((905, -85, 1280, 240), fill=GOLD)
    draw.ellipse((790, 88, 1060, 358), fill=SAND)
    draw.text((MARGIN_X, 68), title, font=title_font, fill=CARD)
    draw.text((MARGIN_X + 4, 156), subtitle, font=subtitle_font, fill="#F7EFD9")
    draw.line((MARGIN_X, 222, PAGE_SIZE[0] - MARGIN_X, 222), fill="#EBDCB4", width=3)


def _draw_metric_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str, value: str, accent: str) -> None:
    _draw_rounded_card(draw, box, fill=CARD)
    draw.rounded_rectangle((box[0] + 18, box[1] + 18, box[0] + 54, box[1] + 54), radius=10, fill=accent)
    label_font = _font(18, bold=True)
    value_font = _font(30, bold=True, serif=True)
    draw.text((box[0] + 24, box[1] + 76), label.upper(), font=label_font, fill=MUTED)
    draw.text((box[0] + 24, box[1] + 122), value, font=value_font, fill=TEXT)


def _draw_key_value_rows(
    draw: ImageDraw.ImageDraw,
    title: str,
    payload: dict[str, Any],
    box: tuple[int, int, int, int],
    money_keys: set[str] | None = None,
) -> None:
    money_keys = money_keys or set()
    _draw_rounded_card(draw, box)
    title_font = _font(28, bold=True, serif=True)
    body_font = _font(20)
    draw.text((box[0] + 28, box[1] + 24), title, font=title_font, fill=TEXT)

    y = box[1] + 82
    row_height = 46
    available_rows = max(int((box[3] - y - 20) / row_height), 0)
    items = list(payload.items())[:available_rows]
    for index, (key, value) in enumerate(items):
        if index:
            draw.line((box[0] + 24, y - 12, box[2] - 24, y - 12), fill=BORDER, width=2)
        label = _labelize(key)
        display = _money(value) if key in money_keys or isinstance(value, (int, float)) else str(value)
        draw.text((box[0] + 28, y), label, font=body_font, fill=TEXT_SOFT)
        text_width, _ = _text_size(draw, display, body_font)
        draw.text((box[2] - 28 - text_width, y), display, font=body_font, fill=TEXT)
        y += row_height


def _flatten_income_schedule(income_schedule: dict[str, Any]) -> list[tuple[str, float]]:
    items: list[tuple[str, float]] = []
    for key, value in (income_schedule or {}).items():
        if key == "special_rate_income" and isinstance(value, dict):
            for inner_key, inner_value in value.items():
                amount = _safe_float(inner_value)
                if amount > 0:
                    items.append((_labelize(inner_key), amount))
            continue
        amount = _safe_float(value)
        if amount > 0:
            items.append((_labelize(key), amount))
    return items


def _flatten_simple_payload(payload: dict[str, Any]) -> list[tuple[str, float]]:
    items: list[tuple[str, float]] = []
    for key, value in (payload or {}).items():
        if isinstance(value, dict):
            for inner_key, inner_value in value.items():
                amount = _safe_float(inner_value)
                if amount > 0:
                    items.append((_labelize(inner_key), amount))
        else:
            amount = _safe_float(value)
            if amount > 0:
                items.append((_labelize(key), amount))
    return items


def _draw_horizontal_bar_chart(
    draw: ImageDraw.ImageDraw,
    title: str,
    items: list[tuple[str, float]],
    box: tuple[int, int, int, int],
    bar_color: str,
) -> None:
    _draw_rounded_card(draw, box)
    title_font = _font(28, bold=True, serif=True)
    label_font = _font(18)
    value_font = _font(18, bold=True)
    draw.text((box[0] + 28, box[1] + 24), title, font=title_font, fill=TEXT)

    chart_items = items[:6]
    if not chart_items:
        draw.text((box[0] + 28, box[1] + 86), "No chart data available.", font=label_font, fill=MUTED)
        return

    max_value = max(amount for _, amount in chart_items) or 1.0
    start_y = box[1] + 88
    bar_left = box[0] + 28
    bar_right = box[2] - 28
    bar_width = bar_right - bar_left
    row_gap = 82

    for index, (label, value) in enumerate(chart_items):
        y = start_y + index * row_gap
        draw.text((bar_left, y), label, font=label_font, fill=TEXT_SOFT)
        value_text = _money(value)
        text_width, _ = _text_size(draw, value_text, value_font)
        draw.text((bar_right - text_width, y), value_text, font=value_font, fill=TEXT)

        track_top = y + 32
        track_bottom = track_top + 22
        draw.rounded_rectangle((bar_left, track_top, bar_right, track_bottom), radius=11, fill=PAPER_ALT)
        fill_right = bar_left + int((value / max_value) * bar_width)
        draw.rounded_rectangle((bar_left, track_top, max(fill_right, bar_left + 20), track_bottom), radius=11, fill=bar_color)


def _draw_donut_chart(
    draw: ImageDraw.ImageDraw,
    title: str,
    parts: list[tuple[str, float, str]],
    box: tuple[int, int, int, int],
    center_label: str,
) -> None:
    _draw_rounded_card(draw, box)
    title_font = _font(28, bold=True, serif=True)
    label_font = _font(18)
    value_font = _font(20, bold=True)
    center_font = _font(26, bold=True, serif=True)
    draw.text((box[0] + 28, box[1] + 24), title, font=title_font, fill=TEXT)

    valid_parts = [(label, value, color) for label, value, color in parts if value > 0]
    if not valid_parts:
        draw.text((box[0] + 28, box[1] + 86), "No data available.", font=label_font, fill=MUTED)
        return

    total = sum(value for _, value, _ in valid_parts) or 1.0
    cx = box[0] + 230
    cy = box[1] + 265
    outer = 135
    inner = 78
    start_angle = -90
    for _, value, color in valid_parts:
        end_angle = start_angle + (value / total) * 360
        draw.pieslice((cx - outer, cy - outer, cx + outer, cy + outer), start=start_angle, end=end_angle, fill=color)
        start_angle = end_angle
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=CARD, outline=CARD)

    label_lines = center_label.split("\n")
    current_y = cy - 24
    for idx, line in enumerate(label_lines):
        font = _font(18) if idx == 0 else center_font
        fill = MUTED if idx == 0 else TEXT
        width, height = _text_size(draw, line, font)
        draw.text((cx - width / 2, current_y), line, font=font, fill=fill)
        current_y += height + 6

    legend_x = box[0] + 420
    legend_y = box[1] + 110
    for label, value, color in valid_parts[:5]:
        draw.rounded_rectangle((legend_x, legend_y + 6, legend_x + 18, legend_y + 24), radius=6, fill=color)
        draw.text((legend_x + 30, legend_y), label, font=label_font, fill=TEXT_SOFT)
        draw.text((legend_x + 30, legend_y + 28), _money(value), font=value_font, fill=TEXT)
        legend_y += 88


def _draw_table(
    draw: ImageDraw.ImageDraw,
    title: str,
    columns: list[str],
    rows: list[list[str]],
    box: tuple[int, int, int, int],
) -> None:
    _draw_rounded_card(draw, box)
    title_font = _font(28, bold=True, serif=True)
    header_font = _font(18, bold=True)
    body_font = _font(18)
    draw.text((box[0] + 28, box[1] + 24), title, font=title_font, fill=TEXT)

    table_top = box[1] + 82
    table_left = box[0] + 22
    table_right = box[2] - 22
    widths = [0.36, 0.18, 0.18, 0.28]
    col_x = [table_left]
    running = table_left
    total_width = table_right - table_left
    for width in widths[:-1]:
        running += int(total_width * width)
        col_x.append(running)
    col_x.append(table_right)

    draw.rounded_rectangle((table_left, table_top, table_right, table_top + 44), radius=14, fill=PAPER_ALT)
    for idx, column in enumerate(columns):
        draw.text((col_x[idx] + 14, table_top + 11), column, font=header_font, fill=BROWN)

    row_y = table_top + 62
    for row in rows:
        if row_y + 50 > box[3] - 20:
            break
        draw.line((table_left, row_y - 10, table_right, row_y - 10), fill=BORDER, width=1)
        for idx, cell in enumerate(row):
            max_width = col_x[idx + 1] - col_x[idx] - 22
            clipped = _fit_text(draw, str(cell), body_font, max_width)
            draw.text((col_x[idx] + 14, row_y), clipped, font=body_font, fill=TEXT_SOFT)
        row_y += 56


def _build_cover_page(draft_packet: dict[str, Any], review_payload: dict[str, Any]) -> Image.Image:
    image = Image.new("RGB", PAGE_SIZE, PAPER)
    draw = ImageDraw.Draw(image)
    _draw_header_band(draw, "TaxAI Filing Dossier", "Structured return packet for review and approval")

    body_font = _font(22)
    title_font = _font(34, bold=True, serif=True)
    small_font = _font(18)

    summary = draft_packet.get("itr_fields", {})
    reconciliation_summary = draft_packet.get("reconciliation_summary", {})
    ready = bool(review_payload.get("ready_for_approval"))

    hero_box = (MARGIN_X, 300, PAGE_SIZE[0] - MARGIN_X, 600)
    _draw_rounded_card(draw, hero_box, fill=CARD)
    draw.text((hero_box[0] + 34, hero_box[1] + 28), "Return Overview", font=title_font, fill=TEXT)

    overview_lines = [
        f"Job ID: {draft_packet.get('job_id', '-')}",
        f"Profile Type: {str(draft_packet.get('profile_type', '-')).replace('_', ' ').title()}",
        f"Financial Year: {draft_packet.get('financial_year', '-')}",
        f"Suggested ITR Form: {draft_packet.get('suggested_itr_form', '-')}",
        f"Tax Regime: {str(draft_packet.get('regime', '-')).title()}",
    ]
    y = hero_box[1] + 98
    for line in overview_lines:
        draw.text((hero_box[0] + 34, y), line, font=body_font, fill=TEXT_SOFT)
        y += 42

    status_box = (hero_box[2] - 305, hero_box[1] + 40, hero_box[2] - 34, hero_box[1] + 214)
    draw.rounded_rectangle(status_box, radius=22, fill="#F3EEE4", outline=BORDER, width=2)
    status_label = "Ready for Approval" if ready else "Needs Review"
    status_color = GREEN if ready else RED
    draw.text((status_box[0] + 24, status_box[1] + 24), "STATUS", font=small_font, fill=MUTED)
    draw.text((status_box[0] + 24, status_box[1] + 66), status_label, font=_font(30, bold=True, serif=True), fill=status_color)
    draw.text((status_box[0] + 24, status_box[1] + 118), f"Issues: {reconciliation_summary.get('issues_count', 0)}", font=body_font, fill=TEXT_SOFT)

    metric_y = 650
    gap = 20
    card_w = (CONTENT_WIDTH - (gap * 3)) // 4
    metrics = [
        ("Gross Income", _money(summary.get("gross_total_income", 0)), GOLD),
        ("Taxable Income", _money(summary.get("taxable_income", 0)), BROWN),
        ("Tax Liability", _money(summary.get("total_tax_liability", 0)), RED),
        ("Refund / Balance", _money(summary.get("refund_due", 0) or summary.get("balance_tax_payable", 0)), GREEN),
    ]
    for idx, (label, value, accent) in enumerate(metrics):
        left = MARGIN_X + idx * (card_w + gap)
        _draw_metric_card(draw, (left, metric_y, left + card_w, metric_y + 205), label, value, accent)

    narrative_box = (MARGIN_X, 910, PAGE_SIZE[0] - MARGIN_X, 1250)
    _draw_rounded_card(draw, narrative_box)
    draw.text((narrative_box[0] + 34, narrative_box[1] + 26), "Executive Summary", font=title_font, fill=TEXT)
    summary_text = (
        "This filing packet consolidates key return metrics, deductions, tax credits, and review observations "
        "into a structured approval-ready summary."
    )
    y = _draw_wrapped_text(draw, summary_text, narrative_box[0] + 34, narrative_box[1] + 88, narrative_box[2] - narrative_box[0] - 68, body_font, TEXT_SOFT)
    y += 18
    note_lines = [
        f"Total taxes paid: {_money(summary.get('total_taxes_paid', 0))}",
        f"Tax before rebate: {_money(summary.get('tax_before_rebate', 0))}",
        f"Review tasks pending: {reconciliation_summary.get('review_tasks_count', 0)}",
    ]
    for line in note_lines:
        draw.text((narrative_box[0] + 34, y), line, font=body_font, fill=TEXT_SOFT)
        y += 38

    blockers = review_payload.get("review_blockers", [])[:4]
    blockers_title = "Critical Review Notes" if blockers else "Review Notes"
    review_box = (MARGIN_X, 1290, PAGE_SIZE[0] - MARGIN_X, 1660)
    _draw_rounded_card(draw, review_box)
    draw.text((review_box[0] + 34, review_box[1] + 26), blockers_title, font=title_font, fill=TEXT)
    if blockers:
        row_y = review_box[1] + 92
        for blocker in blockers:
            draw.rounded_rectangle((review_box[0] + 34, row_y, review_box[2] - 34, row_y + 54), radius=18, fill="#FBF2F1")
            draw.text((review_box[0] + 52, row_y + 14), f"{blocker.get('field', 'Item')}: {blocker.get('message', '')}", font=small_font, fill=RED)
            row_y += 72
    else:
        draw.text((review_box[0] + 34, review_box[1] + 98), "No high-severity blockers were detected in the current review state.", font=body_font, fill=GREEN)

    draw.text((MARGIN_X, 1688), "Prepared by TaxAI • Internal draft for taxpayer review", font=small_font, fill=MUTED)
    return image


def _build_financial_page(draft_packet: dict[str, Any]) -> Image.Image:
    image = Image.new("RGB", PAGE_SIZE, PAPER)
    draw = ImageDraw.Draw(image)
    _draw_header_band(draw, "Financial Schedules", "Income composition, deductions, credits, and filing ratios")

    summary = draft_packet.get("itr_fields", {})
    income_schedule = draft_packet.get("income_schedule", {})
    deduction_schedule = draft_packet.get("deduction_schedule", {})
    credit_schedule = draft_packet.get("credit_schedule", {})

    income_items = _flatten_income_schedule(income_schedule)
    deduction_items = _flatten_simple_payload(deduction_schedule)
    credit_items = _flatten_simple_payload(credit_schedule)

    _draw_horizontal_bar_chart(draw, "Income Composition", income_items, (MARGIN_X, 310, 760, 880), GOLD)
    tax_parts = [
        ("Taxes Paid", _safe_float(summary.get("total_taxes_paid", 0)), GREEN),
        ("Liability", _safe_float(summary.get("total_tax_liability", 0)), RED),
        ("Deductions", _safe_float(summary.get("total_deductions", 0)), GOLD),
    ]
    _draw_donut_chart(draw, "Tax Position Snapshot", tax_parts, (790, 310, PAGE_SIZE[0] - MARGIN_X, 880), "Tax\nMix")

    _draw_key_value_rows(
        draw,
        "Deduction Schedule",
        deduction_schedule,
        (MARGIN_X, 920, 590, 1600),
        money_keys=set(deduction_schedule.keys()),
    )
    _draw_key_value_rows(
        draw,
        "Credit Schedule",
        credit_schedule,
        (620, 920, PAGE_SIZE[0] - MARGIN_X, 1600),
        money_keys=set(credit_schedule.keys()),
    )

    footer_box = (MARGIN_X, 1624, PAGE_SIZE[0] - MARGIN_X, 1688)
    draw.rounded_rectangle(footer_box, radius=18, fill=PAPER_ALT)
    footer_text = (
        f"Net outcome: {_money(summary.get('refund_due', 0) or summary.get('balance_tax_payable', 0))} • "
        f"Taxable income stands at {_money(summary.get('taxable_income', 0))}."
    )
    draw.text((footer_box[0] + 24, footer_box[1] + 18), footer_text, font=_font(20), fill=TEXT_SOFT)
    return image


def _build_review_page(draft_packet: dict[str, Any], review_payload: dict[str, Any]) -> Image.Image:
    image = Image.new("RGB", PAGE_SIZE, PAPER)
    draw = ImageDraw.Draw(image)
    _draw_header_band(draw, "Review & Evidence", "Operational checks, document trail, and review readiness")

    body_font = _font(20)
    title_font = _font(28, bold=True, serif=True)

    review_tasks = review_payload.get("review_tasks", [])[:6]
    documents = draft_packet.get("canonical_documents", [])[:8]

    left_box = (MARGIN_X, 310, 620, 980)
    _draw_rounded_card(draw, left_box)
    draw.text((left_box[0] + 28, left_box[1] + 24), "Review Workflow", font=title_font, fill=TEXT)

    review_lines = [
        f"Ready for approval: {'Yes' if review_payload.get('ready_for_approval') else 'No'}",
        f"High-severity blockers: {len(review_payload.get('review_blockers', []))}",
        f"Review tasks open: {len(review_payload.get('review_tasks', []))}",
    ]
    y = left_box[1] + 88
    for line in review_lines:
        draw.text((left_box[0] + 28, y), line, font=body_font, fill=TEXT_SOFT)
        y += 40
    y += 10
    if review_tasks:
        for task in review_tasks:
            card = (left_box[0] + 24, y, left_box[2] - 24, y + 86)
            draw.rounded_rectangle(card, radius=18, fill=CARD, outline=BORDER, width=2)
            draw.text((card[0] + 18, card[1] + 14), str(task.get("field", "Review item")).title(), font=_font(18, bold=True), fill=BROWN)
            _draw_wrapped_text(draw, str(task.get("message", "")), card[0] + 18, card[1] + 40, card[2] - card[0] - 36, _font(16), TEXT_SOFT, line_gap=4)
            y += 102
            if y > left_box[3] - 100:
                break
    else:
        draw.text((left_box[0] + 28, y), "No review tasks are currently pending.", font=body_font, fill=GREEN)

    columns = ["Document", "Type", "Confidence", "Status"]
    table_rows: list[list[str]] = []
    for document in documents:
        doc_type = str(document.get("document_type", "")).replace("_", " ").title()
        source_name = str(document.get("source_name", "") or "-")
        summary = document.get("summary", {})
        confidence_hint = "-"
        if isinstance(summary, dict):
            if "rows" in summary:
                confidence_hint = f"{summary.get('rows')} rows"
            elif "gross_amount" in summary:
                confidence_hint = _money(summary.get("gross_amount"))
        table_rows.append([source_name, doc_type, confidence_hint, "Captured"])
    _draw_table(draw, "Document Trail", columns, table_rows, (650, 310, PAGE_SIZE[0] - MARGIN_X, 1110))

    summary_box = (650, 1142, PAGE_SIZE[0] - MARGIN_X, 1660)
    _draw_rounded_card(draw, summary_box)
    draw.text((summary_box[0] + 28, summary_box[1] + 24), "Filing Notes", font=title_font, fill=TEXT)
    notes = [
        "This PDF is designed for professional review and approval workflows.",
        "Amounts shown are based on the current structured draft return packet.",
        "Any portal filing should occur only after taxpayer confirmation and final validation.",
    ]
    y = summary_box[1] + 88
    for note in notes:
        draw.rounded_rectangle((summary_box[0] + 26, y, summary_box[2] - 26, y + 64), radius=18, fill=PAPER_ALT)
        draw.text((summary_box[0] + 46, y + 18), note, font=body_font, fill=TEXT_SOFT)
        y += 82
    return image


def render_itr_pdf(draft_packet: dict[str, Any], review_payload: dict[str, Any]) -> bytes:
    pages = [
        _build_cover_page(draft_packet, review_payload).convert("RGB"),
        _build_financial_page(draft_packet).convert("RGB"),
        _build_review_page(draft_packet, review_payload).convert("RGB"),
    ]
    buffer = BytesIO()
    pages[0].save(buffer, format="PDF", resolution=150.0, save_all=True, append_images=pages[1:])
    return buffer.getvalue()


def save_itr_pdf(output_dir: str, filename: str, draft_packet: dict[str, Any], review_payload: dict[str, Any]) -> str:
    path = Path(output_dir)
    path.mkdir(parents=True, exist_ok=True)
    file_path = path / filename
    file_path.write_bytes(render_itr_pdf(draft_packet, review_payload))
    return str(file_path)
