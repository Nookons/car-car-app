"""Оркестрация sweep: завершение прохода и подтверждение снятий."""

from datetime import UTC, datetime, timedelta

import httpx

from carcar.config import Settings
from carcar.db import UpsertResult
from carcar.parse import SearchPage
from carcar.runner import sweep
from carcar.store import Store


def _dt(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, tzinfo=UTC)


class FakeSink:
    """Минимальный sink для проверки оркестрации sweep без Postgres."""

    def __init__(self) -> None:
        self.state = {
            "next_page": 1,
            "total_pages": None,
            "inserted": 0,
            "updated": 0,
            "pass_started_at": None,
            "completed_at": None,
            "last_pages": None,
            "last_errors": None,
        }
        self.calls: list[object] = []
        self.pass_started = _dt(2026, 11, 12)

    def source_id(self, code: str) -> int:
        return 1

    def sweep_state(self, code: str) -> dict:
        return dict(self.state)

    def set_sweep_state(self, code: str, **kwargs: object) -> None:
        self.state.update(kwargs)

    def begin_sweep_pass(self, code: str) -> datetime:
        self.calls.append("begin")
        self.state.update(
            next_page=1,
            total_pages=None,
            inserted=0,
            updated=0,
            pass_started_at=self.pass_started,
            completed_at=None,
        )
        return self.pass_started

    def complete_sweep_pass(self, code: str, **kwargs: object) -> None:
        self.calls.append(("complete", kwargs))
        self.state.update(kwargs)
        self.state["completed_at"] = datetime.now(UTC)

    def reconcile_removed(self, code: str, pass_started_at: datetime, **kwargs: object) -> dict:
        self.calls.append(("reconcile", pass_started_at, kwargs))
        return {"removed": 3, "archived": 3}

    def upsert(self, items: list, code: str) -> UpsertResult:
        return UpsertResult()

    def set_paused(self, *args: object, **kwargs: object) -> None:
        self.calls.append(("paused", args, kwargs))


def _client(settings: Settings, calls: list[int] | None = None) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(1)
        return httpx.Response(200, text="ok")

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_sweep_completes_and_reconciles(tmp_path, monkeypatch):
    sink = FakeSink()
    settings = Settings(data_dir=tmp_path, rps=1000)
    store = Store(root=tmp_path)
    monkeypatch.setattr(
        "carcar.runner.parse_search",
        lambda html, url: SearchPage(url=url, total=32, page_size=32, offset=0, items=[]),
    )

    summary = sweep(_client(settings), store, settings, sink=sink)

    assert summary["completed"] is True
    assert summary["removed"] == 3
    assert "begin" in sink.calls
    reconcile = next(
        call
        for call in sink.calls
        if isinstance(call, tuple) and call[0] == "reconcile"
    )
    assert reconcile[1] == sink.pass_started
    assert reconcile[2]["pages"] == 1


def test_sweep_stopped_by_max_pages_does_not_reconcile(tmp_path, monkeypatch):
    sink = FakeSink()
    settings = Settings(data_dir=tmp_path, rps=1000)
    store = Store(root=tmp_path)
    monkeypatch.setattr(
        "carcar.runner.parse_search",
        lambda html, url: SearchPage(url=url, total=96, page_size=32, offset=0, items=[]),
    )

    summary = sweep(_client(settings), store, settings, sink=sink, max_pages=1)

    assert summary["completed"] is False
    assert summary["removed"] == 0
    assert not any(
        isinstance(call, tuple) and call[0] == "reconcile" for call in sink.calls
    )
    assert not any(
        isinstance(call, tuple) and call[0] == "complete" for call in sink.calls
    )


def test_sweep_skips_recent_completed_pass(tmp_path):
    sink = FakeSink()
    sink.state.update(
        next_page=2,
        total_pages=1,
        pass_started_at=_dt(2026, 11, 12),
        completed_at=datetime.now(UTC),
    )
    settings = Settings(data_dir=tmp_path, rps=1000)
    store = Store(root=tmp_path)
    calls: list[int] = []

    summary = sweep(
        _client(settings, calls), store, settings, sink=sink, min_interval_minutes=60
    )

    assert summary["skipped"] == "interval"
    assert summary["completed"] is False
    assert calls == []


def test_reconcile_after_two_complete_passes(tmp_path, monkeypatch):
    """Первый проход — пропуск 1, второй — подтверждение и снятие."""
    sink = FakeSink()
    settings = Settings(data_dir=tmp_path, rps=1000)
    store = Store(root=tmp_path)
    monkeypatch.setattr(
        "carcar.runner.parse_search",
        lambda html, url: SearchPage(url=url, total=32, page_size=32, offset=0, items=[]),
    )

    sweep(_client(settings), store, settings, sink=sink)
    assert sink.state["completed_at"] is not None
    # Имитируем, что прошёл интервал: новый проход должен начаться.
    sink.state["completed_at"] = datetime.now(UTC) - timedelta(days=1)
    sweep(_client(settings), store, settings, sink=sink)

    reconciles = [
        call
        for call in sink.calls
        if isinstance(call, tuple) and call[0] == "reconcile"
    ]
    assert len(reconciles) == 2


class DbDownSink(FakeSink):
    def upsert(self, items: list, code: str) -> UpsertResult:
        raise RuntimeError("db down")

    def set_paused(self, *args: object, **kwargs: object) -> None:
        raise RuntimeError("db down")


def test_sweep_survives_db_down_and_pause_failure(tmp_path, monkeypatch):
    sink = DbDownSink()
    settings = Settings(data_dir=tmp_path, rps=1000)
    store = Store(root=tmp_path)
    monkeypatch.setattr(
        "carcar.runner.parse_search",
        lambda html, url: SearchPage(url=url, total=32, page_size=32, offset=0, items=[]),
    )
    monkeypatch.setattr("carcar.runner.time.sleep", lambda *_: None)

    summary = sweep(_client(settings), store, settings, sink=sink)

    assert summary["completed"] is False
    assert summary["errors"] == 8
    assert summary["pages"] == 0
