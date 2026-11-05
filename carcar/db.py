"""Запись в Postgres (Supabase): канонические строки, без мусора.

Правила, которые здесь зашиты:
  * повторный сбор не создаёт дублей — конфликт по (source_id, external_id);
  * неизменившиеся строки не перезаписываются, только last_seen_at;
  * история цены пишется только при реальном изменении;
  * невалидные записи уходят в ingest_reject с причиной, а не в listing.
"""

from __future__ import annotations

import contextlib
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .canonical import Prepared, prepare

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.supabase"

INSERT_SQL = """
insert into listing (
    source_id, external_id, url, title, price, currency,
    make, model, year, mileage_km, fuel, gearbox, body, power_hp, engine_cm3,
    color, vin, city, region, lat, lon, seller_type, seller_name,
    thumb_url, photos, photos_count, published_at, content_hash
) values (
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s
)
on conflict (source_id, external_id) do nothing
"""

UPDATE_SQL = """
update listing set
    url = %s, title = %s, price = %s, currency = %s,
    make = %s, model = %s, year = %s, mileage_km = %s,
    fuel = %s, gearbox = %s, body = %s, power_hp = %s, engine_cm3 = %s,
    color = %s, vin = coalesce(%s, vin), city = %s, region = %s,
    lat = coalesce(%s, lat), lon = coalesce(%s, lon),
    seller_type = %s, seller_name = coalesce(%s, seller_name),
    thumb_url = %s, photos = %s, photos_count = %s,
    published_at = coalesce(%s, published_at),
    content_hash = %s, updated_at = now(), last_seen_at = now(),
    status = 'active'
where source_id = %s and external_id = %s
"""

COLUMNS = (
    "url", "title", "price", "currency",
    "make", "model", "year", "mileage_km",
    "fuel", "gearbox", "body", "power_hp", "engine_cm3",
    "color", "vin", "city", "region",
    "lat", "lon", "seller_type", "seller_name",
    "thumb_url", "photos", "photos_count", "published_at", "content_hash",
)


@dataclass
class UpsertResult:
    new_items: list[Any] = field(default_factory=list)
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    rejected: int = 0


def database_url() -> str | None:
    url = os.environ.get("CARCAR_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if url:
        return url.strip()
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return None


class DatabaseSink:
    def __init__(self, url: str) -> None:
        if "ljkugtpeboomboobodom" in url.lower():
            raise RuntimeError("это складская эко-система — писать сюда нельзя")
        self._url = url
        self.conn = self._connect()
        self._sources: dict[str, int] = {}

    def _connect(self):  # noqa: ANN202
        import psycopg

        conn = psycopg.connect(self._url, connect_timeout=15)
        conn.autocommit = False
        return conn

    def _reconnect(self) -> None:
        """Пулер рвёт простаивающие соединения — переподключаемся и пробуем ещё раз."""
        with contextlib.suppress(Exception):
            self.conn.close()
        self.conn = self._connect()
        self._sources.clear()

    # -- источники ---------------------------------------------------------
    def source_id(self, code: str = "otomoto") -> int:
        if code in self._sources:
            return self._sources[code]
        with self.conn.cursor() as cur:
            cur.execute("select id from source where code = %s", (code,))
            row = cur.fetchone()
        if not row:
            raise RuntimeError(f"источник {code} не зарегистрирован в source")
        self._sources[code] = row[0]
        return row[0]

    # -- запись ------------------------------------------------------------
    def upsert(self, items: list[Any], code: str = "otomoto") -> UpsertResult:
        try:
            return self._upsert(items, code)
        except Exception as exc:  # noqa: BLE001
            if "connection" not in str(exc).lower() and "server closed" not in str(exc).lower():
                raise
            self._reconnect()
            return self._upsert(items, code)

    def _upsert(self, items: list[Any], code: str) -> UpsertResult:
        source_id = self.source_id(code)
        result = UpsertResult()

        prepared: list[tuple[Any, dict[str, Any]]] = []
        rejects: list[tuple[str, str]] = []
        for item in items:
            ready: Prepared = prepare(item, source_id)
            if ready.ok and ready.row is not None:
                prepared.append((item, ready.row))
            else:
                rejects.append((str(getattr(item, "id", "")), ready.reason or "invalid"))

        if rejects:
            with self.conn.cursor() as cur:
                cur.executemany(
                    "insert into ingest_reject (source_id, external_id, reason) "
                    "values (%s, %s, %s)",
                    [(source_id, ext, reason) for ext, reason in rejects],
                )
            result.rejected = len(rejects)

        if not prepared:
            self.conn.commit()
            return result

        external_ids = [row["external_id"] for _, row in prepared]
        existing: dict[str, tuple[Any, str, str]] = {}
        with self.conn.cursor() as cur:
            cur.execute(
                """
                select external_id, price, content_hash, status
                from listing
                where source_id = %s and external_id = any(%s)
                """,
                (source_id, external_ids),
            )
            for ext, price, digest, status in cur.fetchall():
                existing[ext] = (price, digest, status)

        inserts: list[tuple[Any, ...]] = []
        updates: list[tuple[Any, ...]] = []
        unchanged: list[str] = []
        events: list[tuple[str, str, Any, Any]] = []

        for item, row in prepared:
            old = existing.get(row["external_id"])
            if old is None:
                inserts.append(
                    (source_id, row["external_id"], *(row[c] for c in COLUMNS))
                )
                result.new_items.append(item)
                result.inserted += 1
            elif old[1] != row["content_hash"]:
                updates.append(tuple(row[c] for c in COLUMNS) + (source_id, row["external_id"]))
                result.updated += 1
                if old[0] is not None and old[0] != row["price"]:
                    kind = "price_drop" if row["price"] < old[0] else "price_up"
                    events.append((row["external_id"], kind, old[0], row["price"]))
            else:
                unchanged.append(row["external_id"])
                result.unchanged += 1

        with self.conn.cursor() as cur:
            if inserts:
                cur.executemany(INSERT_SQL, inserts)
            if updates:
                cur.executemany(UPDATE_SQL, updates)
            if unchanged:
                cur.execute(
                    """
                    update listing set last_seen_at = now()
                    where source_id = %s and external_id = any(%s)
                    """,
                    (source_id, unchanged),
                )
            if events:
                cur.executemany(
                    """
                    insert into listing_event (listing_id, kind, old_price, new_price)
                    select id, %s, %s, %s from listing
                    where source_id = %s and external_id = %s
                    """,
                    [(kind, old, new, source_id, ext) for ext, kind, old, new in events],
                )
        self.conn.commit()
        return result

    def update_detail(
        self,
        external_id: str,
        *,
        photos: list[str] | None = None,
        vin: str | None = None,
        lat: float | None = None,
        lon: float | None = None,
        seller_name: str | None = None,
        seller_type: str | None = None,
        code: str = "otomoto",
    ) -> bool:
        """Обогащение после загрузки карточки: фото, VIN, точные координаты."""
        try:
            return self._update_detail(
                external_id,
                photos=photos,
                vin=vin,
                lat=lat,
                lon=lon,
                seller_name=seller_name,
                seller_type=seller_type,
                code=code,
            )
        except Exception as exc:  # noqa: BLE001
            if "connection" not in str(exc).lower():
                raise
            self._reconnect()
            return self._update_detail(
                external_id,
                photos=photos,
                vin=vin,
                lat=lat,
                lon=lon,
                seller_name=seller_name,
                seller_type=seller_type,
                code=code,
            )

    def _update_detail(
        self,
        external_id: str,
        *,
        photos: list[str] | None = None,
        vin: str | None = None,
        lat: float | None = None,
        lon: float | None = None,
        seller_name: str | None = None,
        seller_type: str | None = None,
        code: str = "otomoto",
    ) -> bool:
        photos = [p for p in (photos or []) if isinstance(p, str) and p.startswith("https://")][:8]
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                update listing set
                    photos = case when cardinality(%s::text[]) > 0 then %s::text[] else photos end,
                    photos_count = case
                        when cardinality(%s::text[]) > 0 then %s else photos_count
                    end,
                    vin = coalesce(%s, vin),
                    lat = coalesce(%s, lat),
                    lon = coalesce(%s, lon),
                    seller_name = coalesce(%s, seller_name),
                    seller_type = coalesce(%s, seller_type),
                    updated_at = now()
                where source_id = %s and external_id = %s
                """,
                (
                    photos, photos, photos, len(photos),
                    vin, lat, lon, seller_name, seller_type,
                    source_id, external_id,
                ),
            )
            changed = cur.rowcount
        self.conn.commit()
        return bool(changed)

    # -- наблюдаемость -----------------------------------------------------
    def log_run(
        self,
        *,
        code: str,
        started_at: datetime,
        result: UpsertResult,
        pages: int,
        items: int,
        errors: int = 0,
        notes: str | None = None,
    ) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                insert into crawl_run (source_id, started_at, finished_at, pages, items,
                                       inserted, updated, unchanged, rejected, errors, notes)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    self.source_id(code), started_at, datetime.now(UTC), pages, items,
                    result.inserted, result.updated, result.unchanged, result.rejected,
                    errors, notes,
                ),
            )
        self.conn.commit()

    def stats(self) -> dict[str, Any]:
        with self.conn.cursor() as cur:
            cur.execute("select count(*) from listing")
            total = cur.fetchone()[0]
            cur.execute("select count(*) from listing where status = 'active'")
            active = cur.fetchone()[0]
            cur.execute("select count(*) from listing_event")
            events = cur.fetchone()[0]
            cur.execute("select pg_size_pretty(pg_total_relation_size('listing'))")
            size = cur.fetchone()[0]
        return {"total": total, "active": active, "events": events, "listing_size": size}

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> DatabaseSink:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
