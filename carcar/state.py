"""Состояние коллектора: heartbeat, пауза, прогресс обхода.

На Railway у каждого сборщика свой контейнер без общего диска, поэтому
состояние хранится в базе (таблицы `collector` и `sweep_state`). Локально,
без DATABASE_URL, используется папка `data/state` — чтобы можно было работать
офлайн.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from .control import load_control, save_control
from .db import DatabaseSink
from .store import Store

SWEEP_DEFAULTS: dict[str, Any] = {
    "next_page": 1,
    "total_pages": None,
    "inserted": 0,
    "updated": 0,
    "pass_started_at": None,
    "completed_at": None,
    "last_pages": None,
    "last_errors": None,
}


class CollectorState:
    def __init__(self, store: Store, source: str, sink: DatabaseSink | None = None) -> None:
        self.store = store
        self.source = source
        self.sink = sink

    # -- heartbeat ---------------------------------------------------------
    def heartbeat(self, payload: dict[str, Any]) -> None:
        if self.sink is not None:
            self.sink.heartbeat(self.source, payload)
        # Локальная копия — для дашборда, запущенного на той же машине.
        self.store.write_heartbeat(payload)

    # -- пауза -------------------------------------------------------------
    def paused(self) -> tuple[bool, str | None]:
        if self.sink is not None:
            return self.sink.is_paused(self.source)
        control = load_control(self.store.control_path)
        return control.paused, control.reason

    def set_paused(self, paused: bool, reason: str | None = None, by: str = "collector") -> None:
        if self.sink is not None:
            self.sink.set_paused(self.source, paused, reason, by)
        save_control(self.store.control_path, paused=paused, reason=reason, by=by)

    # -- прогресс обхода ---------------------------------------------------
    def _local_load(self) -> dict[str, Any]:
        path = self.store.state_dir / "sweep.json"
        if not path.exists():
            return dict(SWEEP_DEFAULTS)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return dict(SWEEP_DEFAULTS)
        return {**SWEEP_DEFAULTS, **data} if isinstance(data, dict) else dict(SWEEP_DEFAULTS)

    def _local_save(self, payload: dict[str, Any]) -> None:
        self.store._atomic_write(
            self.store.state_dir / "sweep.json",
            json.dumps(payload, ensure_ascii=False),
        )

    def sweep_load(self) -> dict[str, Any]:
        if self.sink is not None:
            return self.sink.sweep_state(self.source)
        return self._local_load()

    def sweep_save(
        self, *, next_page: int, total_pages: int | None, inserted: int, updated: int
    ) -> None:
        if self.sink is not None:
            self.sink.set_sweep_state(
                self.source,
                next_page=next_page,
                total_pages=total_pages,
                inserted=inserted,
                updated=updated,
            )
            return
        payload = self._local_load() | {
            "next_page": next_page,
            "total_pages": total_pages,
            "inserted": inserted,
            "updated": updated,
        }
        self._local_save(payload)

    def begin_sweep_pass(self) -> datetime:
        """Начинает новый полный проход и возвращает его точку отсчёта."""
        if self.sink is not None:
            return self.sink.begin_sweep_pass(self.source)
        now = datetime.now(UTC)
        self._local_save(
            {
                **SWEEP_DEFAULTS,
                "pass_started_at": now.isoformat(),
            }
        )
        return now

    def complete_sweep_pass(
        self,
        *,
        pages: int,
        total_pages: int,
        errors: int,
        inserted: int,
        updated: int,
    ) -> None:
        """Фиксирует завершённый проход, не сбрасывая его точку отсчёта."""
        if self.sink is not None:
            self.sink.complete_sweep_pass(
                self.source,
                pages=pages,
                total_pages=total_pages,
                errors=errors,
                inserted=inserted,
                updated=updated,
            )
            return
        payload = self._local_load() | {
            "completed_at": datetime.now(UTC).isoformat(),
            "last_pages": pages,
            "last_errors": errors,
            "next_page": total_pages + 1,
            "inserted": inserted,
            "updated": updated,
        }
        self._local_save(payload)
