"""История цены: стартовая точка, изменения и текущая цена."""

from datetime import UTC, datetime

from carcar.miniapp.repo import _card, _price_history

ROW = {
    "id": 1,
    "external_id": "6150000001",
    "url": "https://www.otomoto.pl/osobowe/oferta/test.html",
    "title": "Volvo V40",
    "price": 37000,
    "currency": "PLN",
    "first_seen_at": datetime(2026, 11, 6, 12, 0, tzinfo=UTC),
    "last_seen_at": datetime(2026, 11, 9, 12, 0, tzinfo=UTC),
}

EVENTS = [
    {
        "kind": "price_drop",
        "old_price": 39000,
        "new_price": 37900,
        "observed_at": "2026-11-07T18:22:33+00:00",
    },
    {
        "kind": "price_drop",
        "old_price": 37900,
        "new_price": 37000,
        "observed_at": "2026-11-08T18:22:27+00:00",
    },
]


def test_history_starts_from_first_old_price():
    history, initial = _price_history(ROW, EVENTS)

    assert initial == 39000
    assert [point["price"] for point in history] == [39000, 37900, 37000]
    assert history[0]["kind"] == "initial"
    assert history[0]["at"].startswith("2026-11-06")
    assert history[1]["kind"] == "price_drop"


def test_no_events_means_no_history():
    history, initial = _price_history(ROW, [])

    assert history == []
    assert initial == 37000


def test_current_price_is_appended_when_changed_since_last_event():
    events = EVENTS[:1]
    history, initial = _price_history({**ROW, "price": 36500}, events)

    assert initial == 39000
    assert [point["price"] for point in history] == [39000, 37900, 36500]
    assert history[-1]["kind"] == "current"


def test_card_exposes_history_and_initial_price():
    history, initial = _price_history(ROW, EVENTS)
    card = _card(ROW, [], price_history=history, initial_price=initial)

    assert card["initial_price"] == 39000
    assert [point["price"] for point in card["price_history"]] == [39000, 37900, 37000]
