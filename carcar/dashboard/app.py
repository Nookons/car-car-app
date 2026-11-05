"""Дашборд сборщика: видно, что он жив, и можно поставить на паузу.

Сборщик и дашборд — разные процессы, связанные файлами:
  * `heartbeat.json` пишет сборщик, читает дашборд → статус и метрики;
  * `control.json` пишет дашборд (или CLI), читает сборщик → пауза.

Поэтому дашборд работает, даже если сборщик упал (и показывает это),
а пауза переживает перезапуск обоих.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..control import load_control, save_control
from ..store import Store

STATIC = Path(__file__).parent / "static"
STATS_TTL = 10.0  # статистика папки считается не на каждый запрос


class ControlIn(BaseModel):
    paused: bool
    reason: str | None = Field(default=None, max_length=200)
    by: str = Field(default="dashboard", max_length=40)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def create_app(root: str | Path = "data", source: str = "otomoto") -> FastAPI:
    store = Store(root=Path(root), source=source)
    cache: dict[str, tuple[float, dict]] = {}

    app = FastAPI(title="CarCar dashboard", docs_url=None, redoc_url=None)
    app.mount("/static", StaticFiles(directory=STATIC), name="static")

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC / "index.html")

    def storage_stats() -> dict:
        now = time.monotonic()
        cached = cache.get("storage")
        if cached and now - cached[0] < STATS_TTL:
            return cached[1]
        data = store.stats()
        cache["storage"] = (now, data)
        return data

    @app.get("/api/status")
    def status() -> dict:
        heartbeat = store.read_heartbeat()
        control = load_control(store.control_path)
        now = datetime.now(UTC)

        age = None
        started_at = _parse_iso(heartbeat.get("ts")) if heartbeat else None
        if started_at:
            age = max(0.0, (now - started_at).total_seconds())

        interval = float((heartbeat or {}).get("interval") or 15.0)
        stale_after = max(60.0, interval * 4)

        state = "never"
        if control.paused:
            # Намерение пользователя важнее того, что успел записать сборщик.
            state = "paused"
        elif heartbeat:
            if age is not None and age <= stale_after:
                state = str(heartbeat.get("status") or "running")
            else:
                state = "stale"

        return {
            "now": now.isoformat(),
            "state": state,
            "age_seconds": round(age, 1) if age is not None else None,
            "stale_after": stale_after,
            "heartbeat": heartbeat,
            "control": control.as_dict(),
            "storage": storage_stats(),
            "polls": store.read_polls(limit=60),
            "runs": store.recent_runs(limit=5),
        }

    @app.post("/api/control")
    def control_set(payload: ControlIn) -> dict:
        state = save_control(
            store.control_path,
            paused=payload.paused,
            reason=payload.reason,
            by=payload.by,
        )
        return {"ok": True, "control": state.as_dict()}

    return app
