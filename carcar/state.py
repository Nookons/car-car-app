"""Состояние коллектора: heartbeat, пауза, прогресс обхода.

На Railway у каждого сборщика свой контейнер без общего диска, поэтому
состояние хранится в базе (таблицы `collector` и `sweep_state`). Локально,
без DATABASE_URL, используется папка `data/state` — чтобы можно было работать
офлайн.
"""

from __future__ import annotations

import json
from typing import Any

from .control import load_control, save_control
from .db import DatabaseSink
from .store import Store


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
    def sweep_load(self) -> dict[str, Any]:
        if self.sink is not None:
            return self.sink.sweep_state(self.source)
        path = self.store.state_dir / "sweep.json"
        if not path.exists():
            return {"next_page": 1, "total_pages": None, "inserted": 0, "updated": 0}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"next_page": 1, "total_pages": None, "inserted": 0, "updated": 0}

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
        payload = {
            "next_page": next_page,
            "total_pages": total_pages,
            "inserted": inserted,
            "updated": updated,
        }
        self.store._atomic_write(
            self.store.state_dir / "sweep.json",
            json.dumps(payload, ensure_ascii=False),
        )
