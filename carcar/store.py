"""Хранилище на диске: «пока что просто папка», но без потерь и дублей.

Структура:

    data/
      otomoto/
        listings/2026-11-05/6151080882.json   # полный ответ карточки
        discovered.ndjson                     # строки выдачи (только новые)
      state/
        otomoto_seen.txt                      # id, которые уже видели
      runs/
        2026-11-05T12-30-00Z.json             # сводка прогона

Почему так:
  * атомарная запись (tmp + os.replace) — не бывает полуфайлов при обрыве;
  * карточки разложены по дням — в одной папке не будет 250 тыс. файлов;
  * discovered.ndjson пишется только на новые id — иначе за сутки 250 тыс.
    дублей по 32 строки на поллинг;
  * id, которые уже видели, лежат отдельно — повторный запуск не дублирует.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass
class Store:
    root: Path = field(default_factory=lambda: Path("data"))
    source: str = "otomoto"
    _seen: set[str] | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        self.root = Path(self.root)
        self.base = self.root / self.source
        self.listings_dir = self.base / "listings"
        self.discovered_path = self.base / "discovered.ndjson"
        self.state_dir = self.root / "state"
        self.seen_path = self.state_dir / f"{self.source}_seen.txt"
        self.runs_dir = self.root / "runs"
        for path in (self.listings_dir, self.state_dir, self.runs_dir):
            path.mkdir(parents=True, exist_ok=True)

    # -- запись -----------------------------------------------------------
    @staticmethod
    def _atomic_write(path: Path, text: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        with tmp.open("w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)  # атомарная подмена: читатель видит либо старое, либо новое

    def save_detail(
        self,
        payload: dict[str, Any],
        *,
        listing_id: str,
        url: str,
        fetched_at: datetime | None = None,
        refresh: bool = False,
    ) -> Path | None:
        """Сохраняет карточку. Возвращает путь или None, если она уже есть."""
        fetched_at = fetched_at or utcnow()
        path = self.listings_dir / fetched_at.strftime("%Y-%m-%d") / f"{listing_id}.json"
        if path.exists() and not refresh:
            return None
        envelope = {
            "schema": 1,
            "source": self.source,
            "listing_id": listing_id,
            "url": url,
            "fetched_at": fetched_at.isoformat(),
            "data": payload,
        }
        self._atomic_write(
            path, json.dumps(envelope, ensure_ascii=False, separators=(",", ":"))
        )
        return path

    def append_discovered(
        self, rows: Iterable[dict[str, Any]], fetched_at: datetime | None = None
    ) -> int:
        """Дописывает новые строки выдачи в ndjson. Возвращает число строк."""
        fetched_at = fetched_at or utcnow()
        stamp = fetched_at.isoformat()
        lines = []
        for row in rows:
            item = dict(row)
            item["seen_at"] = stamp
            lines.append(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
        if not lines:
            return 0
        with self.discovered_path.open("a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        return len(lines)

    def write_run(self, summary: dict[str, Any], started_at: datetime | None = None) -> Path:
        started_at = started_at or utcnow()
        path = self.runs_dir / f"{started_at.strftime('%Y-%m-%dT%H-%M-%SZ')}.json"
        self._atomic_write(path, json.dumps(summary, ensure_ascii=False, indent=1))
        return path

    # -- состояние «что уже видели» ---------------------------------------
    def load_seen(self) -> set[str]:
        if self._seen is None:
            if self.seen_path.exists():
                self._seen = {
                    line.strip()
                    for line in self.seen_path.read_text(encoding="utf-8").splitlines()
                    if line.strip()
                }
            else:
                self._seen = set()
        return self._seen

    def add_seen(self, ids: Iterable[str]) -> int:
        seen = self.load_seen()
        fresh = [i for i in ids if i and i not in seen]
        if not fresh:
            return 0
        with self.seen_path.open("a", encoding="utf-8") as handle:
            handle.write("\n".join(fresh) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        seen.update(fresh)
        return len(fresh)

    # -- чтение ------------------------------------------------------------
    def iter_discovered(self) -> Iterator[dict[str, Any]]:
        if not self.discovered_path.exists():
            return iter(())
        return (
            json.loads(line)
            for line in self.discovered_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        )

    def find_listing(self, listing_id: str) -> dict[str, Any] | None:
        for row in self.iter_discovered():
            if row.get("id") == listing_id:
                return row
        return None

    def stats(self) -> dict[str, Any]:
        files = list(self.listings_dir.rglob("*.json"))
        disk = sum(f.stat().st_size for f in files)
        discovered = sum(1 for _ in self.iter_discovered()) if self.discovered_path.exists() else 0
        return {
            "detail_files": len(files),
            "detail_bytes": disk,
            "discovered_rows": discovered,
            "seen_ids": len(self.load_seen()),
            "root": str(self.root),
        }
