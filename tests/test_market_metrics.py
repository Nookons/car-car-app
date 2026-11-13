"""Рыночные метрики: чистый расчёт без БД."""

from carcar.market_metrics import compose_metrics, segment_key


def _subject() -> dict:
    return {
        "id": 1,
        "make": "BMW",
        "model": "320",
        "price": 100_000,
        "year": 2019,
        "mileage_km": 80_000,
        "engine_cm3": 2000,
        "power_hp": 190,
        "body": "sedan",
        "gearbox": "automatic",
        "drive": "rwd",
        "fuel": "petrol",
        "color": "black",
        "generation": "G20",
        "equipment": ["abs", "ac", "navi"],
        "title": "BMW 320",
    }


def _comps() -> list[dict]:
    rows = []
    for index, price in enumerate(range(105_000, 125_000, 1_000)):
        rows.append(
            {
                "id": 100 + index,
                "price": price,
                "year": 2019,
                "mileage_km": 75_000 + index * 1500,
                "engine_cm3": 2000,
                "power_hp": 190,
                "body": "sedan",
                "gearbox": "automatic",
                "drive": "rwd",
                "fuel": "petrol",
                "color": "black",
                "generation": "G20",
                "equipment": ["abs", "ac"],
                "title": f"BMW 320 {index}",
            }
        )
    return rows


def _lifecycle() -> list[dict]:
    return [
        {"outcome": "sold_candidate", "dom_days": 10},
        {"outcome": "sold_candidate", "dom_days": 15},
        {"outcome": "sold_candidate", "dom_days": 20},
        {"outcome": "sold_candidate", "dom_days": 25},
        {"outcome": "sold_candidate", "dom_days": 30},
        {"outcome": "expired", "dom_days": 30},
    ]


def test_compose_metrics_price_and_dom():
    metrics = compose_metrics(_subject(), _comps(), _lifecycle(), stage="final")
    assert metrics["active_count"] == 20
    assert metrics["used_count"] >= 5
    assert metrics["estimate"] is not None
    assert metrics["verdict"] == "below"
    assert metrics["sold_candidate_count"] == 5
    assert metrics["dom_sample"] == 5
    assert metrics["dom_median"] == 20
    assert metrics["off_market_count"] == 6
    assert metrics["confidence"] in {"medium", "high"}
    assert metrics["stage"] == "final"
    assert metrics["report"]["lifecycle"]["sold_candidates"] == 5


def test_compose_metrics_without_active_comps_is_honest():
    metrics = compose_metrics(_subject(), [], _lifecycle())
    assert metrics["estimate"] is None
    assert metrics["confidence"] == "low"
    assert "no_price_analysis" in metrics["flags"]
    assert "preliminary" in metrics["flags"]


def test_compose_metrics_without_lifecycle_flags_no_dom():
    metrics = compose_metrics(_subject(), _comps(), [], stage="final")
    assert metrics["dom_sample"] == 0
    assert metrics["dom_median"] is None
    assert "no_dom" in metrics["flags"]
    # Цена надёжная, но без срока продажи high не выдаём.
    assert metrics["confidence"] == "medium"


def test_segment_key_is_stable_and_lowercase():
    key = segment_key(_subject())
    assert key.startswith("bmw|320|2015|petrol|automatic|sedan")
