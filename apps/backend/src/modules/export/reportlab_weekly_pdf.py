import json
import os
import sys
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def to_float(value, default=0.0):
    try:
        parsed = float(value)
        if parsed != parsed:
            return default
        return parsed
    except Exception:
        return default


def to_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def safe_dict(value):
    return value if isinstance(value, dict) else {}


def safe_list(value):
    return value if isinstance(value, list) else []


def text_line(pdf, text, x, y):
    pdf.drawString(x, y, text)


def section_title(pdf, text, y):
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(40, y, text)
    pdf.setFont("Helvetica", 10)


def render_payload(payload, output_path):
    week_plan = safe_dict(payload.get("weekPlan"))
    adherence = safe_dict(payload.get("adherence"))
    optimization = safe_dict(payload.get("optimization"))
    user_info = safe_dict(payload.get("userInfo"))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    pdf = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    y = height - 40

    pdf.setFont("Helvetica-Bold", 16)
    text_line(pdf, "AYUDIET Weekly Plan", 40, y)
    y -= 22

    pdf.setFont("Helvetica", 10)
    user_id = str(user_info.get("user_id", "anonymous"))
    date_range = str(payload.get("dateRange", "N/A"))
    text_line(pdf, f"User: {user_id}", 40, y)
    y -= 14
    text_line(pdf, f"Date Range: {date_range}", 40, y)
    y -= 24

    section_title(pdf, "Daily Plans", y)
    y -= 16

    for day in safe_list(week_plan.get("week_plan")):
        if y < 100:
            pdf.showPage()
            pdf.setFont("Helvetica", 10)
            y = height - 40

        day_number = to_int(safe_dict(day).get("day"), 0)
        summary = safe_dict(day).get("nutrition_summary", {})
        summary = safe_dict(summary)

        pdf.setFont("Helvetica-Bold", 10)
        text_line(pdf, f"Day {day_number}", 40, y)
        y -= 14
        pdf.setFont("Helvetica", 9)

        meals = safe_dict(day).get("meals", {})
        meals = safe_dict(meals)
        for meal_name in ["breakfast", "lunch", "dinner"]:
            items = safe_list(meals.get(meal_name))
            if len(items) == 0:
                text_line(pdf, f"  {meal_name}: -", 48, y)
                y -= 12
                continue

            rendered = []
            for item in items:
                entry = safe_dict(item)
                name = str(entry.get("name") or entry.get("recipe_id") or "item")
                quantity = safe_dict(entry.get("quantity"))
                qty_value = to_float(quantity.get("value"), 0)
                qty_unit = str(quantity.get("unit") or "grams")
                rendered.append(f"{name} ({qty_value:.2f} {qty_unit})")

            text_line(pdf, f"  {meal_name}: {', '.join(rendered)}", 48, y)
            y -= 12

        text_line(
            pdf,
            "  nutrition: "
            f"cal {to_float(summary.get('calories')):.2f}, "
            f"pro {to_float(summary.get('protein')):.2f}, "
            f"carb {to_float(summary.get('carbs')):.2f}, "
            f"fat {to_float(summary.get('fat')):.2f}",
            48,
            y,
        )
        y -= 16

    if y < 180:
        pdf.showPage()
        pdf.setFont("Helvetica", 10)
        y = height - 40

    section_title(pdf, "Optimization Summary", y)
    y -= 16

    before = safe_dict(optimization.get("before"))
    after = safe_dict(optimization.get("after"))
    before_totals = safe_dict(before.get("weekly_totals"))
    after_totals = safe_dict(after.get("weekly_totals"))

    text_line(pdf, f"Before calories: {to_float(before_totals.get('calories')):.2f}", 40, y)
    y -= 12
    text_line(pdf, f"After calories: {to_float(after_totals.get('calories')):.2f}", 40, y)
    y -= 12
    text_line(
        pdf,
        (
            "Before macros (P/C/F): "
            f"{to_float(before_totals.get('protein')):.2f}/"
            f"{to_float(before_totals.get('carbs')):.2f}/"
            f"{to_float(before_totals.get('fat')):.2f}"
        ),
        40,
        y,
    )
    y -= 12
    text_line(
        pdf,
        (
            "After macros (P/C/F): "
            f"{to_float(after_totals.get('protein')):.2f}/"
            f"{to_float(after_totals.get('carbs')):.2f}/"
            f"{to_float(after_totals.get('fat')):.2f}"
        ),
        40,
        y,
    )
    y -= 20

    section_title(pdf, "Adherence Summary", y)
    y -= 16

    stats = safe_dict(adherence.get("stats"))
    text_line(pdf, f"Adherence score: {to_float(adherence.get('adherence_score')):.4f}", 40, y)
    y -= 12
    text_line(
        pdf,
        (
            "Behavior (followed/skipped/modified): "
            f"{to_int(stats.get('meals_followed'))}/"
            f"{to_int(stats.get('meals_skipped'))}/"
            f"{to_int(stats.get('meals_modified'))}"
        ),
        40,
        y,
    )
    y -= 20

    section_title(pdf, "Explanation", y)
    y -= 16

    deterministic = str(payload.get("deterministic_explanation") or "Post-processing adjustments applied with deterministic scaling only.")
    ai_explanation = str(payload.get("ai_explanation") or "")

    text_line(pdf, f"Deterministic: {deterministic[:120]}", 40, y)
    y -= 12
    if ai_explanation:
        text_line(pdf, f"AI: {ai_explanation[:120]}", 40, y)
        y -= 12

    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    text_line(pdf, f"Generated (UTC): {timestamp}", 40, max(30, y - 10))

    pdf.save()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("Usage: reportlab_weekly_pdf.py <payload_json_path> <output_pdf_path>")

    payload_path = sys.argv[1]
    output_pdf_path = sys.argv[2]

    with open(payload_path, "r", encoding="utf-8") as payload_file:
        payload = json.load(payload_file)

    render_payload(payload, output_pdf_path)
