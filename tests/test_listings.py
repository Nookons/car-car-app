import httpx
import pytest
from fastapi.testclient import TestClient

from carcar.client import Client
from carcar.config import Settings
from carcar.dashboard.app import create_app
from carcar.parse import parse_offer
from carcar.store import Store


def make_row(**overrides) -> dict:
    row = {
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
        "seller_type": "PROFESSIONAL",
        "thumbnail": "https://cdn.example/thumb.jpg",
        "is_pinned": False,
    }
    row.update(overrides)
    return row


@pytest.fixture()
def store(tmp_path) -> Store:
    return Store(root=tmp_path)


@pytest.fixture()
def client(store, monkeypatch) -> TestClient:
    password = "test-dashboard-password"
    monkeypatch.setenv("CARCAR_DASHBOARD_PASSWORD", password)
    with TestClient(create_app(root=store.root), base_url="https://testserver") as test_client:
        assert test_client.post("/api/session", json={"password": password}).status_code == 200
        yield test_client


def test_listings_empty(client):
    data = client.get("/api/listings").json()
    assert data["items"] == []
    assert data["total"] == 0


def test_listings_returns_recent_first(client, store):
    store.append_discovered([make_row(id="1"), make_row(id="2"), make_row(id="3")])
    items = client.get("/api/listings").json()["items"]

    assert [i["id"] for i in items] == ["3", "2", "1"]
    assert items[0]["has_detail"] is False


def test_listing_page_served(client):
    response = client.get("/listing/123")
    assert response.status_code == 200
    assert "CarCar" in response.text


def test_card_without_detail_uses_feed_data(client, store):
    store.append_discovered([make_row()])
    card = client.get("/api/listings/6150000001").json()

    assert card["has_detail"] is False
    assert card["price"] == 45900
    assert card["year"] == 2015
    assert card["photos"] == ["https://cdn.example/thumb.jpg"]  # миниатюра из выдачи
    assert card["city"] == "Warszawa"


def test_card_404_for_unknown(client):
    assert client.get("/api/listings/999999").status_code == 404


def test_card_with_saved_detail(client, store, offer_html):
    offer = parse_offer(offer_html)
    store.append_discovered([make_row(id=offer.id)])
    store.save_detail(offer.raw, listing_id=offer.id, url=offer.url)

    card = client.get(f"/api/listings/{offer.id}").json()
    assert card["has_detail"] is True
    assert len(card["photos"]) >= 1
    assert card["photos"][0].startswith("http")
    assert card["description"]
    assert card["details"]["make"]


def test_fetch_endpoint_downloads_card(store, offer_html, monkeypatch):
    monkeypatch.setenv("CARCAR_DASHBOARD_PASSWORD", "test-dashboard-password")
    offer = parse_offer(offer_html)
    store.append_discovered([make_row(id=offer.id, url=offer.url)])

    def factory(settings: Settings) -> Client:
        return Client(
            settings,
            transport=httpx.MockTransport(lambda request: httpx.Response(200, text=offer_html)),
        )

    with TestClient(
        create_app(root=store.root, client_factory=factory), base_url="https://testserver"
    ) as client:
        assert (
            client.post(
                "/api/session", json={"password": "test-dashboard-password"}
            ).status_code
            == 200
        )
        response = client.post(f"/api/listings/{offer.id}/fetch")

        assert response.status_code == 200
        assert response.json()["saved"] is True
        assert store.find_detail_file(offer.id) is not None

        # повторный вызов не ходит на площадку
        again = client.post(f"/api/listings/{offer.id}/fetch").json()
        assert again["already"] is True


def test_fetch_unknown_listing_404(client):
    assert client.post("/api/listings/123456/fetch").status_code == 404


def test_listings_fill_coordinates_from_city(client, store):
    store.append_discovered([make_row(id="777", city="Gdańsk")])
    item = client.get("/api/listings").json()["items"][0]
    assert item["lat"] is not None and item["lon"] is not None
    assert round(item["lat"], 1) == 54.4


def test_listings_distance_filter(client, store):
    store.append_discovered(
        [
            make_row(id="1", city="Warszawa", lat=52.22977, lon=21.01178),
            make_row(id="2", city="Kraków", lat=50.06143, lon=19.93658),
        ]
    )
    data = client.get(
        "/api/listings", params={"lat": 52.23, "lon": 21.01, "radius_km": 50}
    ).json()

    assert [i["id"] for i in data["items"]] == ["1"]
    assert data["items"][0]["distance_km"] < 5
    assert data["filtered"] is True


def test_listings_sorted_by_distance(client, store):
    store.append_discovered(
        [
            make_row(id="far", city="Kraków", lat=50.06, lon=19.94),
            make_row(id="near", city="Warszawa", lat=52.23, lon=21.01),
        ]
    )
    items = client.get("/api/listings", params={"lat": 52.23, "lon": 21.01}).json()["items"]
    assert items[0]["id"] == "near"
    assert items[0]["distance_km"] < items[1]["distance_km"]
