"""Мост событий: сборщик публикует price_drop через API, суммы не теряются."""

from fastapi.testclient import TestClient

import carcar.bus as bus_module
import carcar.miniapp.api as miniapp


class FakeRepo:
    def close(self) -> None:
        pass


class FakeBus:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def publish(self, event: dict) -> None:
        self.events.append(event)


def make_client(monkeypatch, bus: FakeBus) -> TestClient:
    monkeypatch.setenv("CARCAR_INGEST_TOKEN", "secret")
    monkeypatch.setattr(bus_module, "make_bus", lambda: bus)
    monkeypatch.setattr(miniapp, "MiniAppRepo", lambda url: FakeRepo())
    return TestClient(
        miniapp.create_app(db_url="postgresql://fake", bot_token="token", jwt_secret="secret")
    )


def test_ingest_keeps_prices_for_price_drop(monkeypatch):
    bus = FakeBus()
    client = make_client(monkeypatch, bus)

    response = client.post(
        "/api/ingest/events",
        json={
            "events": [
                {
                    "type": "listing.price_drop",
                    "source": "otomoto",
                    "external_id": "6150373432",
                    "old_price": 39000,
                    "new_price": 37900,
                }
            ]
        },
        headers={"X-Ingest-Token": "secret"},
    )

    assert response.status_code == 200
    assert bus.events == [
        {
            "type": "listing.price_drop",
            "source": "otomoto",
            "external_id": "6150373432",
            "old_price": 39000,
            "new_price": 37900,
        }
    ]


def test_ingest_rejects_bad_token(monkeypatch):
    client = make_client(monkeypatch, FakeBus())

    response = client.post(
        "/api/ingest/events",
        json={"events": []},
        headers={"X-Ingest-Token": "wrong"},
    )

    assert response.status_code == 403
