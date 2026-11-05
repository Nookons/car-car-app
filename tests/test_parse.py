import pytest

from carcar.parse import ParseError, extract_next_data, parse_offer, parse_search


def test_parse_search_extracts_listings(search_html):
    page = parse_search(search_html, url="https://example/search")

    assert page.total > 0
    assert page.page_size == 32
    assert len(page.items) == 3  # фикстура обрезана до трёх строк

    first = page.items[0]
    assert first.id.isdigit()
    assert first.url.startswith("https://www.otomoto.pl/")
    assert first.price and first.price > 0
    assert first.currency == "PLN"
    assert first.year and 1990 < first.year < 2030
    assert first.mileage_km is None or first.mileage_km >= 0
    assert first.city  # город должен быть


def test_parse_search_normalizes_numbers(search_html):
    page = parse_search(search_html)
    for item in page.items:
        if item.mileage_km is not None:
            assert isinstance(item.mileage_km, int)
            assert item.mileage_km < 2_000_000
        if item.engine_cm3 is not None:
            assert 600 < item.engine_cm3 < 9000
        if item.power_hp is not None:
            assert 20 < item.power_hp < 2000


def test_parse_search_row_is_serializable(search_html):
    import json

    row = parse_search(search_html).items[0].to_row()
    assert json.loads(json.dumps(row))["id"] == row["id"]
    assert set(row) >= {"id", "price", "make", "model", "mileage_km", "city"}


def test_parse_offer(offer_html):
    offer = parse_offer(offer_html)

    assert offer.id.isdigit()
    assert offer.title
    assert offer.price and offer.price > 0
    assert offer.details.get("make")
    assert offer.details.get("year")
    assert len(offer.photos) >= 1
    assert offer.photos[0].startswith("http")
    assert offer.description and "<" not in offer.description
    assert offer.seller_type in {"PROFESSIONAL", "PRIVATE", ""}
    assert offer.equipment_count > 0
    assert offer.raw["id"] == offer.id


def test_extract_without_next_data_raises():
    with pytest.raises(ParseError):
        extract_next_data("<html><body>blocked</body></html>")


def test_broken_json_raises():
    html = '<script id="__NEXT_DATA__">{not json}</script>'
    with pytest.raises(ParseError):
        extract_next_data(html)
