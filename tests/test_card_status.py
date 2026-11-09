"""Статус объявления в карточке: снятое с продажи не должно выглядеть активным."""

from carcar.miniapp.repo import _card


def make_row(**overrides) -> dict:
    row = {
        "id": 1,
        "external_id": "6150000001",
        "url": "https://www.otomoto.pl/osobowe/oferta/test.html",
        "title": "Audi A4 2.0 TDI",
        "price": 45900,
        "currency": "PLN",
        "status": "removed",
    }
    row.update(overrides)
    return row


def test_card_keeps_removed_status():
    assert _card(make_row(), [])["status"] == "removed"


def test_card_defaults_to_active():
    assert _card(make_row(status=None), [])["status"] == "active"
