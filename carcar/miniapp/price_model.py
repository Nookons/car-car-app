"""Прозрачная оценка цены по похожим объявлениям.

Модель не фильтрует по цвету/поколению: они дают вес похожести. Цена —
взвешенная медиана похожих машин, скорректированная на разницу в годе,
пробеге, объёме, мощности и комплектации. Все коэффициенты считаются по
самой выборке, поэтому отчёт показывает, откуда взялась цифра.
"""

from __future__ import annotations

import math
from typing import Any

# Сумма весов = 1. Цвет и поколение намеренно с малым весом: они влияют
# на похожесть, но не отсекают объявления.
MODEL_VERSION = 4

WEIGHTS: dict[str, float] = {
    "year": 0.20,
    "mileage": 0.17,
    "engine": 0.13,
    "power": 0.07,
    "body": 0.10,
    "gearbox": 0.07,
    "drive": 0.06,
    "fuel": 0.05,
    "generation": 0.05,
    "equipment": 0.05,
    "color": 0.05,
}

CATEGORY_KEYS = ("body", "gearbox", "drive", "fuel", "generation", "color")


def _price(row: dict[str, Any]) -> float | None:
    value = row.get("price")
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _weighted_quantile(points: list[tuple[float, float]], q: float) -> float | None:
    if not points:
        return None
    ordered = sorted(points, key=lambda item: item[0])
    total = sum(weight for _, weight in ordered)
    if total <= 0:
        return None
    target = total * q
    running = 0.0
    for value, weight in ordered:
        running += weight
        if running >= target:
            return value
    return ordered[-1][0]


def _weighted_average(points: list[tuple[float, float]]) -> float | None:
    total = sum(weight for _, weight in points)
    if total <= 0:
        return None
    return sum(value * weight for value, weight in points) / total


def _weighted_slope(points: list[tuple[float, float, float]]) -> float:
    """Наклон log(price) по признаку; взвешенный МНК."""
    total = sum(weight for _, _, weight in points)
    if total <= 0 or len(points) < 8:
        return 0.0
    mean_x = sum(x * weight for x, _, weight in points) / total
    mean_y = sum(y * weight for _, y, weight in points) / total
    denominator = sum(weight * (x - mean_x) ** 2 for x, _, weight in points)
    if denominator <= 0:
        return 0.0
    numerator = sum(weight * (x - mean_x) * (y - mean_y) for x, y, weight in points)
    return numerator / denominator


def _weighted_mode(rows: list[tuple[dict[str, Any], float]], key: str) -> Any:
    counts: dict[str, float] = {}
    for row, weight in rows:
        value = row.get(key)
        if value:
            counts[str(value)] = counts.get(str(value), 0.0) + weight
    if not counts:
        return None
    return max(counts, key=counts.get)


def _equipment_set(row: dict[str, Any]) -> set[str]:
    return {str(item).strip().lower() for item in (row.get("equipment") or []) if str(item).strip()}


def _scores(subject: dict[str, Any], comp: dict[str, Any]) -> dict[str, float]:
    scores: dict[str, float] = {}

    def closeness(a: float | None, b: float | None, scale: float) -> float:
        if a is None or b is None:
            return 0.5
        return max(0.0, min(1.0, 1.0 - abs(a - b) / scale))

    scores["year"] = closeness(_number(subject.get("year")), _number(comp.get("year")), 6)
    scores["mileage"] = closeness(
        _number(subject.get("mileage_km")), _number(comp.get("mileage_km")), 80_000
    )
    scores["engine"] = closeness(
        _number(subject.get("engine_cm3")), _number(comp.get("engine_cm3")), 1500
    )
    scores["power"] = closeness(_number(subject.get("power_hp")), _number(comp.get("power_hp")), 150)

    for key in ("body", "gearbox", "drive", "fuel"):
        a, b = subject.get(key), comp.get(key)
        if a is None or b is None:
            scores[key] = 0.5
        else:
            scores[key] = 1.0 if a == b else {"body": 0.3, "gearbox": 0.4, "drive": 0.5}.get(key, 0.5)

    a, b = subject.get("generation"), comp.get("generation")
    scores["generation"] = 0.5 if a is None or b is None else (1.0 if a == b else 0.6)

    a, b = subject.get("color"), comp.get("color")
    scores["color"] = 0.5 if a is None or b is None else (1.0 if a == b else 0.85)

    subject_equipment = _equipment_set(subject)
    comp_equipment = _equipment_set(comp)
    if subject_equipment and comp_equipment:
        union = subject_equipment | comp_equipment
        scores["equipment"] = 0.5 + 0.5 * (len(subject_equipment & comp_equipment) / len(union))
    else:
        scores["equipment"] = 0.6
    return scores


def analyse_price(
    subject: dict[str, Any],
    comparables: list[dict[str, Any]],
    excluded: int = 0,
) -> dict[str, Any] | None:
    price = _price(subject)
    if price is None:
        return None

    candidates: list[tuple[dict[str, Any], float, dict[str, float]]] = []
    subject_id = subject.get("id")
    for comp in comparables:
        if comp.get("id") == subject_id or _price(comp) is None:
            continue
        scores = _scores(subject, comp)
        similarity = sum(WEIGHTS[key] * scores[key] for key in WEIGHTS)
        if similarity < 0.2:
            excluded += 1
            continue
        candidates.append((comp, similarity, scores))

    if len(candidates) < 5:
        return None

    # Отбрасываем ценовые выбросы, чтобы одна битая цена не сдвинула медиану.
    ordered_prices = sorted(_price(comp) for comp, _, _ in candidates)  # type: ignore[arg-type]
    low_cut = ordered_prices[max(0, int(len(ordered_prices) * 0.01) - 1)]
    high_cut = ordered_prices[min(len(ordered_prices) - 1, int(len(ordered_prices) * 0.99))]
    used: list[tuple[dict[str, Any], float, dict[str, float]]] = []
    for comp, similarity, scores in candidates:
        comp_price = _price(comp)
        if comp_price is None or comp_price < low_cut or comp_price > high_cut:
            excluded += 1
            continue
        used.append((comp, similarity, scores))

    if len(used) < 5:
        return None

    weighted_prices: list[tuple[float, float]] = []
    for comp, similarity, _ in used:
        comp_price = _price(comp)
        if comp_price is not None:
            weighted_prices.append((comp_price, similarity))
    base_median = _weighted_quantile(weighted_prices, 0.5)
    base_p10 = _weighted_quantile(weighted_prices, 0.1)
    base_p90 = _weighted_quantile(weighted_prices, 0.9)
    if base_median is None:
        return None
    if base_p10 is None:
        base_p10 = base_median * 0.85
    if base_p90 is None:
        base_p90 = base_median * 1.15

    def average(key: str) -> float | None:
        points = [
            (value, similarity)
            for comp, similarity, _ in used
            if (value := _number(comp.get(key))) is not None
        ]
        return _weighted_average(points)

    avg_year = average("year")
    avg_mileage = average("mileage_km")
    avg_engine = average("engine_cm3")
    avg_power = average("power_hp")
    avg_equipment = _weighted_average(
        [
            (float(len(_equipment_set(comp))), similarity)
            for comp, similarity, _ in used
        ]
    )

    subject_year = _number(subject.get("year"))
    subject_mileage = _number(subject.get("mileage_km"))
    subject_engine = _number(subject.get("engine_cm3"))
    subject_power = _number(subject.get("power_hp"))
    subject_equipment = float(len(_equipment_set(subject)))

    def slope_for(getter, scale: float) -> float:
        points: list[tuple[float, float, float]] = []
        for comp, similarity, _ in used:
            x = getter(comp)
            comp_price = _price(comp)
            if x is None or comp_price is None:
                continue
            points.append((x / scale, math.log(comp_price), similarity))
        return _weighted_slope(points)

    slope_year = min(0.15, max(0.0, slope_for(lambda c: _number(c.get("year")), 1.0)))
    slope_mileage = min(0.01, max(-0.08, slope_for(lambda c: _number(c.get("mileage_km")), 10_000.0)))
    slope_engine = min(0.2, max(-0.1, slope_for(lambda c: _number(c.get("engine_cm3")), 1000.0)))
    slope_power = min(0.1, max(-0.02, slope_for(lambda c: _number(c.get("power_hp")), 100.0)))
    adjustments: dict[str, float] = {}
    if subject_year is not None and avg_year is not None:
        adjustments["year"] = slope_year * (subject_year - avg_year)
    if subject_mileage is not None and avg_mileage is not None:
        adjustments["mileage"] = slope_mileage * ((subject_mileage - avg_mileage) / 10_000.0)
    if subject_engine is not None and avg_engine is not None:
        adjustments["engine"] = slope_engine * ((subject_engine - avg_engine) / 1000.0)
    if subject_power is not None and avg_power is not None:
        adjustments["power"] = slope_power * ((subject_power - avg_power) / 100.0)
    total_adjustment = max(-0.35, min(0.35, sum(adjustments.values())))
    factor = math.exp(total_adjustment)

    estimate = base_median * factor
    range_low = max(1.0, base_p10 * factor)
    range_high = max(range_low, base_p90 * factor)
    diff = round((price - estimate) / estimate * 100)
    verdict = "below" if diff <= -5 else ("above" if diff >= 5 else "fair")

    total_similarity = sum(similarity for _, similarity, _ in used)
    avg_scores = {
        key: sum(similarity * scores[key] for _, similarity, scores in used) / total_similarity
        for key in WEIGHTS
    }
    average_similarity = total_similarity / len(used)
    if len(used) >= 50 and average_similarity >= 0.65:
        confidence = "high"
    elif len(used) >= 15 and average_similarity >= 0.5:
        confidence = "medium"
    else:
        confidence = "low"

    def effect(key: str) -> float | None:
        value = adjustments.get(key)
        return round((math.exp(value) - 1) * 100, 1) if value is not None else None

    def per_unit(key: str, slope: float, scale: float) -> float | None:
        if len(used) < 8:
            return None
        return round((math.exp(slope / scale) - 1) * 100, 1) if scale != 1 else round((math.exp(slope) - 1) * 100, 1)

    criteria: list[dict[str, Any]] = [
        {
            "key": "year",
            "subject": subject.get("year"),
            "market": round(avg_year, 1) if avg_year is not None else None,
            "weight": WEIGHTS["year"],
            "match": round(avg_scores["year"], 2),
            "effect_pct": effect("year"),
            "per_unit_pct": per_unit("year", slope_year, 1.0),
        },
        {
            "key": "mileage",
            "subject": subject.get("mileage_km"),
            "market": round(avg_mileage) if avg_mileage is not None else None,
            "weight": WEIGHTS["mileage"],
            "match": round(avg_scores["mileage"], 2),
            "effect_pct": effect("mileage"),
            "per_unit_pct": round((math.exp(slope_mileage) - 1) * 100, 2) if slope_mileage else None,
        },
        {
            "key": "engine",
            "subject": subject.get("engine_cm3"),
            "market": round(avg_engine) if avg_engine is not None else None,
            "weight": WEIGHTS["engine"],
            "match": round(avg_scores["engine"], 2),
            "effect_pct": effect("engine"),
            "per_unit_pct": round((math.exp(slope_engine) - 1) * 100, 1) if slope_engine else None,
        },
        {
            "key": "power",
            "subject": subject.get("power_hp"),
            "market": round(avg_power) if avg_power is not None else None,
            "weight": WEIGHTS["power"],
            "match": round(avg_scores["power"], 2),
            "effect_pct": effect("power"),
            "per_unit_pct": round((math.exp(slope_power) - 1) * 100, 1) if slope_power else None,
        },
        {
            "key": "equipment",
            "subject": int(subject_equipment),
            "market": round(avg_equipment, 1) if avg_equipment is not None and avg_equipment >= 1 else None,
            "weight": WEIGHTS["equipment"],
            "match": round(avg_scores["equipment"], 2),
            "effect_pct": None,
            "per_unit_pct": None,
        },
    ]
    for key in ("body", "gearbox", "drive", "fuel", "generation", "color"):
        criteria.append(
            {
                "key": key,
                "subject": subject.get(key),
                "market": _weighted_mode([(comp, similarity) for comp, similarity, _ in used], key),
                "weight": WEIGHTS[key],
                "match": round(avg_scores[key], 2),
                "effect_pct": None,
                "per_unit_pct": None,
            }
        )

    top = sorted(used, key=lambda item: item[1], reverse=True)[:6]
    comparable_rows = []
    for comp, similarity, _ in top:
        comp_price = _price(comp)
        comparable_rows.append(
            {
                "id": comp.get("id"),
                "title": comp.get("title"),
                "price": int(comp_price) if comp_price is not None else None,
                "year": comp.get("year"),
                "mileage_km": comp.get("mileage_km"),
                "engine_cm3": comp.get("engine_cm3"),
                "body": comp.get("body"),
                "gearbox": comp.get("gearbox"),
                "drive": comp.get("drive"),
                "color": comp.get("color"),
                "similarity": round(similarity * 100),
            }
        )

    report = {
        "estimated": int(round(estimate)),
        "base_median": int(round(base_median)),
        "range": {"low": int(round(range_low)), "high": int(round(range_high))},
        "confidence": confidence,
        "sample": len(used),
        "excluded": excluded,
        "avg_similarity": round(average_similarity * 100),
        "adjustment_pct": round((factor - 1) * 100, 1),
        "method": "adjusted_comparable_median",
        "model_version": MODEL_VERSION,
        "criteria": criteria,
        "comparables": comparable_rows,
        "notes": [
            "Цена — взвешенная медиана похожих объявлений, скорректированная на год, пробег, объём, мощность и комплектацию.",
            "Цвет и поколение влияют на вес похожести, но не отсекают объявления.",
        ],
    }
    return {
        "model_version": MODEL_VERSION,
        "median": int(round(estimate)),
        "p10": int(round(range_low)),
        "p90": int(round(range_high)),
        "sample": len(used),
        "diff_pct": diff,
        "verdict": verdict,
        "confidence": confidence,
        "method": "adjusted_comparable_median",
        "model_version": MODEL_VERSION,
        "report": report,
    }
