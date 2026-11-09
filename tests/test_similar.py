"""Контракт ручки «похожих объявлений»: без базы, на подменённом репозитории."""

from fastapi.testclient import TestClient

import carcar.miniapp.api as miniapp


class FakeRepo:
    def __init__(self, items=None, missing: bool = False) -> None:
        self.items = items or []
        self.missing = missing
        self.calls: list[tuple[int, int]] = []

    def similar(self, listing_id: int, limit: int = 6):
        self.calls.append((listing_id, limit))
        return None if self.missing else self.items

    def close(self) -> None:
        pass


def make_client(monkeypatch, repo: FakeRepo) -> TestClient:
    monkeypatch.setattr(miniapp, "MiniAppRepo", lambda url: repo)
    return TestClient(
        miniapp.create_app(db_url="postgresql://fake", bot_token="token", jwt_secret="secret")
    )


def test_similar_returns_items_and_forwards_limit(monkeypatch):
    repo = FakeRepo([{"id": 2, "title": "Audi A4", "price": 100, "currency": "PLN"}])
    client = make_client(monkeypatch, repo)

    response = client.get("/api/listings/1/similar?limit=5")

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == 2
    assert repo.calls == [(1, 5)]


def test_similar_is_cached(monkeypatch):
    repo = FakeRepo([{"id": 2}])
    client = make_client(monkeypatch, repo)

    client.get("/api/listings/1/similar")
    client.get("/api/listings/1/similar")

    assert repo.calls == [(1, 6)]


def test_similar_unknown_listing_is_404(monkeypatch):
    client = make_client(monkeypatch, FakeRepo(missing=True))

    response = client.get("/api/listings/999/similar")

    assert response.status_code == 404
    assert "не найдено" in response.json()["detail"]


def test_similar_limit_is_bounded(monkeypatch):
    client = make_client(monkeypatch, FakeRepo())

    assert client.get("/api/listings/1/similar?limit=0").status_code == 422
    assert client.get("/api/listings/1/similar?limit=13").status_code == 422
