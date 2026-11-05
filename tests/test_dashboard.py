from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient

from carcar.client import Client
from carcar.config import Settings
from carcar.control import save_control
from carcar.dashboard.app import create_app
from carcar.runner import watch
from carcar.store import Store


@pytest.fixture()
def app(tmp_path):
    return create_app(root=tmp_path)


@pytest.fixture()
def client(app):
    return TestClient(app)


def test_index_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "CarCar" in response.text


def test_status_never_started(client):
    data = client.get("/api/status").json()
    assert data["state"] == "never"
    assert data["control"]["paused"] is False
    assert data["heartbeat"] is None
    assert data["storage"]["detail_files"] == 0


def test_pause_toggle(client, tmp_path):
    response = client.post(
        "/api/control", json={"paused": True, "reason": "чиним парсер", "by": "dashboard"}
    )
    assert response.status_code == 200

    status = client.get("/api/status").json()
    assert status["control"]["paused"] is True
    assert status["control"]["reason"] == "чиним парсер"
    # даже без heartbeat пользователь видит «пауза»
    assert status["state"] == "paused"

    client.post("/api/control", json={"paused": False})
    assert client.get("/api/status").json()["control"]["paused"] is False


def test_running_and_stale_states(client, tmp_path):
    store = Store(root=tmp_path)
    now = datetime.now(UTC)
    store.write_heartbeat({"status": "running", "ts": now.isoformat(), "interval": 15})
    assert client.get("/api/status").json()["state"] == "running"

    old = (now - timedelta(minutes=10)).isoformat()
    store.write_heartbeat({"status": "running", "ts": old, "interval": 15})
    assert client.get("/api/status").json()["state"] == "stale"


def test_polls_and_storage_in_status(client, tmp_path):
    store = Store(root=tmp_path)
    store.append_poll({"at": datetime.now(UTC).isoformat(), "new": 3, "seconds": 1.2})
    store.save_detail({"id": "1"}, listing_id="1", url="https://x/1")

    data = client.get("/api/status").json()
    assert data["polls"][-1]["new"] == 3
    assert data["storage"]["detail_files"] == 1


def test_watch_does_not_fetch_when_paused(tmp_path):
    store = Store(root=tmp_path)
    save_control(store.control_path, paused=True, reason="тест")
    settings = Settings(data_dir=tmp_path, rps=1000)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(500)

    client = Client(settings, transport=httpx.MockTransport(handler))
    summary = watch(client, store, settings, interval=0.05, minutes=0.05, details=0)

    assert calls["n"] == 0
    assert summary["new_ids"] == 0
    assert store.read_heartbeat()["status"] == "paused"


def test_metrics_available_false_in_file_mode(client):
    data = client.get("/api/metrics").json()
    assert data["available"] is False
    assert data["by_source"] == []
