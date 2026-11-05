
from dataclasses import asdict
from types import SimpleNamespace

from carcar.canonical import MAX_PHOTOS, Prepared, content_hash, prepare
from carcar.parse import Listing


def make_listing(**overrides) -> Listing:
    data = {
        "id": "6150000001",
        "url": "https://www.otomoto.pl/osobowe/oferta/test-ID6aaaa.html",
        "title": "Audi A4 2.0 TDI",
        "created_at": "2026-11-05T10:00:00Z",
        "price": 45900,
        "currency": "PLN",
        "make": "Audi",
        "model": "A4",
        "year": 2015,
        "mileage_km": 180000,
        "fuel": "Diesel",
        "gearbox": "Manualna",
        "engine_cm3": 1968,
        "power_hp": 150,
        "city": "Warszawa",
        "region": "Mazowieckie",
        "seller_type": "ProfessionalSeller",
        "thumbnail": "https://cdn.example/thumb.jpg",
        "is_pinned": False,
        "lat": 52.23,
        "lon": 21.01,
        "geo_source": "city",
    }
    data.update(overrides)
    return Listing(**data)


def make_item(**overrides) -> SimpleNamespace:
    """Listing + поля карточки (photos, vin, body), которых нет в выдаче."""
    data = asdict(make_listing())
    data.update({"photos": [], "vin": None, "body": None, "color": None, "seller_name": None})
    data.update(overrides)
    return SimpleNamespace(**data)


def test_prepare_valid_listing():
    result = prepare(make_item(), source_id=1)
    assert result.ok
    row = result.row
    assert row["fuel"] == "petrol" or row["fuel"] == "diesel"
    assert row["fuel"] == "diesel"
    assert row["gearbox"] == "manual"
    assert row["seller_type"] == "dealer"
    assert row["price"] == 45900
    assert row["lat"] == 52.23


def test_prepare_rejects_garbage():
    cases = {
        "bad_external_id": make_item(id="abc"),
        "bad_url": make_item(url="http://insecure"),
        "bad_title": make_item(title=""),
        "bad_price": make_item(price=0),
    }
    for reason, item in cases.items():
        result = prepare(item, source_id=1)
        assert not result.ok
        assert result.reason == reason


def test_prepare_truncates_photos_and_drops_bad_urls():
    photos = [f"https://cdn.example/{i}.jpg" for i in range(20)]
    photos.append("http://bad/1.jpg")
    result = prepare(make_item(photos=photos), source_id=1)
    assert result.ok
    assert len(result.row["photos"]) == MAX_PHOTOS
    assert all(p.startswith("https://") for p in result.row["photos"])


def test_bad_vin_is_dropped():
    result = prepare(make_item(vin="ABC"), source_id=1)
    assert result.row["vin"] is None


def test_unknown_fuel_becomes_none():
    result = prepare(make_item(fuel="Wodór"), source_id=1)
    assert result.row["fuel"] is None


def test_hash_changes_with_price():
    a = prepare(make_item(price=10000), source_id=1).row
    b = prepare(make_item(price=11000), source_id=1).row
    assert content_hash(a) != content_hash(b)


def test_hash_stable_for_same_content():
    a = prepare(make_item(), source_id=1).row
    b = prepare(make_item(), source_id=1).row
    assert content_hash(a) == content_hash(b)


def test_prepared_dataclass_defaults():
    assert Prepared(None, "x").ok is False
