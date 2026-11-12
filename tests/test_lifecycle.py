"""Жизненный цикл: чистые формулы DOM и подтверждения снятия.

Без импорта БД: эти тесты должны бежать быстро и не зависеть от psycopg.
Оркестрация sweep — в `test_sweep_lifecycle.py`.
"""

from datetime import UTC, datetime

from carcar.lifecycle import (
    dom_days,
    is_confirmed,
    next_missed,
    pass_completed,
    price_change_pct,
)


def _dt(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, tzinfo=UTC)


def test_dom_uses_published_at_when_it_is_earlier():
    days, basis = dom_days(_dt(2026, 1, 1), _dt(2026, 1, 2), _dt(2026, 1, 11))
    assert days == 10.0
    assert basis == "published_at"


def test_dom_falls_back_to_first_seen_when_published_is_missing_or_late():
    days, basis = dom_days(None, _dt(2026, 1, 2), _dt(2026, 1, 12))
    assert days == 10.0
    assert basis == "first_seen_at"

    days, basis = dom_days(_dt(2026, 1, 5), _dt(2026, 1, 2), _dt(2026, 1, 12))
    assert days == 10.0
    assert basis == "first_seen_at"


def test_dom_never_goes_negative():
    days, _ = dom_days(None, _dt(2026, 1, 10), _dt(2026, 1, 1))
    assert days == 0.0


def test_price_change_pct_is_signed():
    assert price_change_pct(100_000, 90_000) == -10.0
    assert price_change_pct(100_000, 110_000) == 10.0
    assert price_change_pct(0, 100) is None
    assert price_change_pct(None, 100) is None


def test_missed_counter_and_confirmation():
    assert next_missed(True, 1) == 0
    assert next_missed(False, 0) == 1
    assert next_missed(False, 1) == 2
    assert is_confirmed(1) is False
    assert is_confirmed(2) is True


def test_pass_completed_requires_full_clean_pass():
    base = {
        "page": 3,
        "total_pages": 2,
        "pages": 2,
        "errors": 0,
        "stopped_early": False,
    }
    assert pass_completed(**base) is True
    assert pass_completed(**{**base, "stopped_early": True}) is False
    assert pass_completed(**{**base, "total_pages": None}) is False
    assert pass_completed(**{**base, "page": 2}) is False
    assert pass_completed(**{**base, "pages": 1}) is False
    assert pass_completed(**{**base, "errors": 2}) is False
