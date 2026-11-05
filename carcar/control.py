"""Пауза сбора: общее состояние на диске.

Дашборд и сборщик — разные процессы. Связывает их файл `control.json`:
дашборд пишет, сборщик читает перед каждым опросом. Плюсы перед HTTP-командой:
  * пауза переживает рестарт сборщика;
  * работает, когда дашборд выключен;
  * не нужен открытый порт у сборщика.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path


def control_path(state_dir: Path) -> Path:
    return state_dir / "control.json"


@dataclass(slots=True)
class Control:
    paused: bool = False
    reason: str | None = None
    updated_at: str | None = None
    updated_by: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def load_control(path: Path) -> Control:
    if not path.exists():
        return Control()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        # Битый файл не должен останавливать сбор: считаем, что паузы нет.
        return Control()
    return Control(
        paused=bool(data.get("paused")),
        reason=data.get("reason"),
        updated_at=data.get("updated_at"),
        updated_by=data.get("updated_by"),
    )


def save_control(
    path: Path, *, paused: bool, reason: str | None = None, by: str = "cli"
) -> Control:
    state = Control(
        paused=paused,
        reason=(reason or "").strip() or None,
        updated_at=datetime.now(UTC).isoformat(),
        updated_by=by,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(state.as_dict(), ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)
    return state
