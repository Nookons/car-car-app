"""Запись в Postgres (Supabase): канонические строки, без мусора.

Правила, которые здесь зашиты:
  * повторный сбор не создаёт дублей — конфликт по (source_id, external_id);
  * неизменившиеся строки не перезаписываются, только last_seen_at;
  * история цены пишется только при реальном изменении;
  * невалидные записи уходят в ingest_reject с причиной, а не в listing.
"""

from __future__ import annotations

import contextlib
import functools
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg

from .canonical import Prepared, prepare
from .lifecycle import (
    MAX_SWEEP_ERROR_RATIO,
    MISSES_TO_REMOVE,
    REMOVAL_GRACE_DAYS,
    classify_outcome,
    dom_days,
    price_change_pct,
)

log = logging.getLogger("carcar")

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
    status = 'active', removed_at = null, missed_sweeps = 0
where source_id = %s and external_id = %s
"""

MARKET_SQL = """
insert into model_option (
    make, model, gearbox, fuel, body, listings,
    year_min, year_max, price_p10, price_median, price_p90, updated_at
)
select
    make, model,
    coalesce(gearbox, ''), coalesce(fuel, ''), coalesce(body, ''),
    count(*)::int, min(year), max(year),
    (percentile_disc(0.1) within group (order by price))::int,
    (percentile_disc(0.5) within group (order by price))::int,
    (percentile_disc(0.9) within group (order by price))::int,
    now()
from listing
where status = 'active'
  and price is not null and price > 0
  and make is not null and make <> ''
  and model is not null and model <> ''
group by 1, 2, 3, 4, 5
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
    # изменения цены для шины: [{"external_id", "kind", "old_price", "new_price"}]
    price_events: list[dict[str, Any]] = field(default_factory=list)


def database_url() -> str | None:
    url = os.environ.get("CARCAR_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if url:
        return url.strip()
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return None


def resilient(method):  # noqa: ANN001
    """Один раз переподключаемся, если соединение с пулером оборвалось."""

    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):  # noqa: ANN001
        try:
            return method(self, *args, **kwargs)
        except (psycopg.OperationalError, psycopg.InterfaceError) as exc:
            log.warning("соединение с БД потеряно (%s) — переподключаюсь", exc)
            self._reconnect()
            return method(self, *args, **kwargs)

    return wrapper


class DatabaseSink:
    def __init__(self, url: str) -> None:
        if "ljkugtpeboomboobodom" in url.lower():
            raise RuntimeError("это складская эко-система — писать сюда нельзя")
        self._url = url
        self.conn = self._connect()
        self._sources: dict[str, int] = {}

    def _connect(self):  # noqa: ANN202
        import psycopg

        conn = psycopg.connect(
            self._url, connect_timeout=15, prepare_threshold=None
        )
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
    @resilient
    def upsert(self, items: list[Any], code: str = "otomoto") -> UpsertResult:
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

        try:
            with self.conn.cursor() as cur:
                if inserts:
                    cur.executemany(INSERT_SQL, inserts)
                if updates:
                    cur.executemany(UPDATE_SQL, updates)
                if unchanged:
                    cur.execute(
                        """
                        update listing set last_seen_at = now(), missed_sweeps = 0
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
            result.price_events = [
                {
                    "external_id": ext,
                    "kind": kind,
                    "old_price": int(old),
                    "new_price": int(new),
                }
                for ext, kind, old, new in events
            ]
            return result
        except Exception as exc:  # noqa: BLE001
            # Одна битая строка не должна ронять всю пачку и весь обход.
            self.conn.rollback()
            log.warning("пачка не записалась (%s) — пишу по одной", exc)
            return self._upsert_individually(prepared, existing, source_id, result, events)

    @resilient
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
        body: str | None = None,
        color: str | None = None,
        power_hp: int | None = None,
        engine_cm3: int | None = None,
        description: str | None = None,
        version: str | None = None,
        generation: str | None = None,
        doors: int | None = None,
        seats: int | None = None,
        drive: str | None = None,
        condition: str | None = None,
        co2_gkm: int | None = None,
        consumption_urban: float | None = None,
        consumption_extra: float | None = None,
        equipment: list[str] | None = None,
        code: str = "otomoto",
    ) -> bool:
        """Обогащение после загрузки карточки: фото, VIN, описание, характеристики."""
        return self._update_detail(
                external_id,
                photos=photos,
                vin=vin,
                lat=lat,
                lon=lon,
                seller_name=seller_name,
                seller_type=seller_type,
                body=body,
                color=color,
                power_hp=power_hp,
                engine_cm3=engine_cm3,
                description=description,
                version=version,
                generation=generation,
                doors=doors,
                seats=seats,
                drive=drive,
                condition=condition,
                co2_gkm=co2_gkm,
                consumption_urban=consumption_urban,
                consumption_extra=consumption_extra,
                equipment=equipment,
                code=code,
            )

    @staticmethod
    def _smallint(value: int | None, low: int, high: int) -> int | None:
        try:
            number = int(value) if value is not None else None
        except (TypeError, ValueError):
            return None
        return number if number is not None and low <= number <= high else None

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
        body: str | None = None,
        color: str | None = None,
        power_hp: int | None = None,
        engine_cm3: int | None = None,
        description: str | None = None,
        version: str | None = None,
        generation: str | None = None,
        doors: int | None = None,
        seats: int | None = None,
        drive: str | None = None,
        condition: str | None = None,
        co2_gkm: int | None = None,
        consumption_urban: float | None = None,
        consumption_extra: float | None = None,
        equipment: list[str] | None = None,
        code: str = "otomoto",
    ) -> bool:
        power_hp = self._smallint(power_hp, 10, 2000)
        engine_cm3 = self._smallint(engine_cm3, 600, 10_000)
        doors = self._smallint(doors, 1, 20)
        seats = self._smallint(seats, 1, 100)
        co2_gkm = self._smallint(co2_gkm, 0, 2000)
        photos = [p for p in (photos or []) if isinstance(p, str) and p.startswith("https://")][:60]
        tags = [tag for tag in (equipment or []) if isinstance(tag, str)][:120]
        source_id = self.source_id(code)
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    update listing set
                        photos = case
                        when cardinality(%s::text[]) > 0 then %s::text[] else photos
                    end,
                    photos_count = case
                        when cardinality(%s::text[]) > 0 then %s else photos_count
                    end,
                    vin = coalesce(%s, vin),
                    lat = coalesce(%s, lat),
                    lon = coalesce(%s, lon),
                    seller_name = coalesce(%s, seller_name),
                    seller_type = coalesce(%s, seller_type),
                    body = coalesce(%s, body),
                    color = coalesce(%s, color),
                    power_hp = coalesce(%s, power_hp),
                    engine_cm3 = coalesce(%s, engine_cm3),
                    description = coalesce(%s, description),
                    version = coalesce(%s, version),
                    generation = coalesce(%s, generation),
                    doors = coalesce(%s, doors),
                    seats = coalesce(%s, seats),
                    drive = coalesce(%s, drive),
                    condition = coalesce(%s, condition),
                    co2_gkm = coalesce(%s, co2_gkm),
                    consumption_urban = coalesce(%s, consumption_urban),
                    consumption_extra = coalesce(%s, consumption_extra),
                    equipment = case
                        when cardinality(%s::text[]) > 0 then %s::text[]
                        else equipment
                    end,
                    details_fetched_at = now(),
                    updated_at = now()
                where source_id = %s and external_id = %s
                """,
                (
                    photos, photos, photos, len(photos),
                    vin, lat, lon, seller_name, seller_type,
                    body, color, power_hp, engine_cm3,
                    (description or None),
                    version or None, generation or None, doors, seats,
                    drive or None, condition or None, co2_gkm,
                    consumption_urban, consumption_extra,
                    tags, tags,
                        source_id, external_id,
                    ),
                )
                changed = cur.rowcount
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        return bool(changed)

    @resilient
    def mark_removed(self, external_id: str, code: str = "otomoto") -> None:
        """Объявление вернуло 404/410 — снимаем с очереди и помечаем removed."""
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                update listing
                set status = 'removed',
                    removed_at = coalesce(removed_at, now()),
                    missed_sweeps = 0,
                    details_fetched_at = now(),
                    updated_at = now()
                where source_id = %s and external_id = %s
                returning id
                """,
                (source_id, external_id),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    """
                    insert into listing_event (listing_id, kind, old_price, new_price)
                    select id, 'removed', price, null
                    from listing
                    where id = %s
                      and not exists (
                          select 1 from listing_event
                          where listing_id = %s and kind = 'removed'
                      )
                    """,
                    (row[0], row[0]),
                )
                self._archive_lifecycle(cur, [row[0]], "gone_404")
        self.conn.commit()

    def _archive_lifecycle(
        self, cur: Any, listing_ids: list[int], removal_kind: str
    ) -> int:
        """Снимает лёгкий снимок объявления в `listing_lifecycle`.

        Таблица переживает `carcar_purge()`: полная строка `listing` с фото
        удаляется, а характеристики, цены и `dom_days` остаются для «Индекса
        ушедших». Пишем только подтверждённые снятия (`removed_at is not null`),
        чтобы админское «скрыть» не попало в статистику продаж.
        """
        if not listing_ids:
            return 0
        from psycopg.rows import dict_row

        with self.conn.cursor(row_factory=dict_row) as rows:
            rows.execute(
                """
                select l.id, l.source_id, l.external_id, l.make, l.model, l.year,
                       l.mileage_km, l.fuel, l.gearbox, l.body, l.power_hp,
                       l.engine_cm3, l.drive, l.generation, l.color, l.city,
                       l.region, l.seller_type, l.price as last_price, l.currency,
                       l.published_at, l.first_seen_at, l.last_seen_at, l.removed_at,
                       l.details_fetched_at,
                       coalesce((
                           select e.old_price from listing_event e
                           where e.listing_id = l.id
                             and e.kind in ('price_drop', 'price_up')
                           order by e.observed_at asc
                           limit 1
                       ), l.price) as first_price,
                       (select count(*)::int from listing_event e
                        where e.listing_id = l.id
                          and e.kind in ('price_drop', 'price_up')) as price_changes
                from listing l
                where l.id = any(%s) and l.removed_at is not null
                """,
                (listing_ids,),
            )
            source_rows = rows.fetchall()

        values = []
        for row in source_rows:
            days, basis = dom_days(
                row["published_at"], row["first_seen_at"], row["last_seen_at"]
            )
            change = price_change_pct(row["first_price"], row["last_price"])
            outcome, reason = classify_outcome(days, change, row["price_changes"])
            values.append(
                (
                    row["id"], row["source_id"], row["external_id"], row["make"],
                    row["model"], row["year"], row["mileage_km"], row["fuel"],
                    row["gearbox"], row["body"], row["power_hp"], row["engine_cm3"],
                    row["drive"], row["generation"], row["color"], row["city"],
                    row["region"], row["seller_type"], row["first_price"],
                    row["last_price"], row["currency"], row["price_changes"],
                    change, row["published_at"], row["first_seen_at"],
                    row["last_seen_at"], row["removed_at"], days, basis,
                    removal_kind, row["details_fetched_at"], outcome, reason,
                )
            )
        if not values:
            return 0
        cur.executemany(
            """
            insert into listing_lifecycle (
                listing_id, source_id, external_id, make, model, year, mileage_km,
                fuel, gearbox, body, power_hp, engine_cm3, drive, generation, color,
                city, region, seller_type, first_price, last_price, currency,
                price_changes, price_change_pct, published_at, first_seen_at,
                last_seen_at, removed_at, dom_days, dom_basis, removal_kind,
                details_fetched_at, outcome, outcome_reason
            ) values (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s
            )
            on conflict (listing_id) do update set
                first_price = excluded.first_price,
                last_price = excluded.last_price,
                price_changes = excluded.price_changes,
                price_change_pct = excluded.price_change_pct,
                removed_at = excluded.removed_at,
                last_seen_at = excluded.last_seen_at,
                dom_days = excluded.dom_days,
                dom_basis = excluded.dom_basis,
                removal_kind = excluded.removal_kind,
                details_fetched_at = excluded.details_fetched_at,
                outcome = excluded.outcome,
                outcome_reason = excluded.outcome_reason
            """,
            values,
        )
        return len(values)

    @resilient
    def reconcile_removed(
        self,
        code: str,
        pass_started_at: datetime,
        *,
        errors: int = 0,
        pages: int = 0,
        min_misses: int = MISSES_TO_REMOVE,
        max_error_ratio: float = MAX_SWEEP_ERROR_RATIO,
        grace_days: int = REMOVAL_GRACE_DAYS,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """Подтверждает снятые после полного обхода.

        Логика в три шага, все в одной транзакции:
          1. кого видели в этом проходе — `missed_sweeps = 0`;
          2. кого не видели — `missed_sweeps += 1`;
          3. кто пропущен `min_misses` полных проходов подряд и не виделся
             `grace_days` дней до старта прохода — `removed`.

        Два пропуска защищают от ложного снятия, если одна страница выдачи
        не открылась. Суточный grace защищает от «перескока» страницы в
        динамической выдаче. Если ошибок в проходе слишком много, не трогаем
        счётчики вообще: лучше подождать чистый проход.
        """
        allowed = max(1, int(pages * max(0.0, max_error_ratio)))
        if errors > allowed:
            log.warning(
                "снятия не подтверждаю: ошибок %s при %s страницах (лимит %s)",
                errors,
                pages,
                allowed,
            )
            return {
                "skipped": "errors",
                "seen": 0,
                "missing": 0,
                "removed": 0,
                "archived": 0,
            }

        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                update listing set missed_sweeps = 0
                where source_id = %s and status = 'active' and last_seen_at >= %s
                """,
                (source_id, pass_started_at),
            )
            seen = cur.rowcount
            cur.execute(
                """
                update listing set missed_sweeps = missed_sweeps + 1
                where source_id = %s and status = 'active' and last_seen_at < %s
                """,
                (source_id, pass_started_at),
            )
            missing = cur.rowcount
            cur.execute(
                """
                select id from listing
                where source_id = %s and status = 'active' and missed_sweeps >= %s
                  and last_seen_at < %s - make_interval(days => %s)
                """,
                (
                    source_id,
                    max(1, min_misses),
                    pass_started_at,
                    max(0, grace_days),
                ),
            )
            candidates = [row[0] for row in cur.fetchall()]

            if dry_run:
                self.conn.rollback()
                return {
                    "seen": seen,
                    "missing": missing,
                    "removed": 0,
                    "archived": 0,
                    "candidates": len(candidates),
                    "dry_run": True,
                }

            removed: list[int] = []
            if candidates:
                cur.execute(
                    """
                    update listing
                    set status = 'removed', removed_at = now(), updated_at = now()
                    where id = any(%s) and status = 'active'
                    returning id
                    """,
                    (candidates,),
                )
                removed = [row[0] for row in cur.fetchall()]
                if removed:
                    cur.execute(
                        """
                        insert into listing_event (listing_id, kind, old_price, new_price)
                        select id, 'removed', price, null
                        from listing where id = any(%s)
                        """,
                        (removed,),
                    )
            archived = self._archive_lifecycle(cur, removed, "disappeared")
        self.conn.commit()
        return {
            "seen": seen,
            "missing": missing,
            "removed": len(removed),
            "archived": archived,
            "candidates": len(candidates),
        }

    @resilient
    def pending_details(
        self, limit: int = 50, shard: int = 0, shards: int = 1,
        *, code: str = "otomoto", exclude_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Drain oldest pending cards; revisit legacy false-success rows daily.

        Errors are excluded for the rest of the run, so one invalid card cannot
        repeatedly occupy the first batch and starve the backlog.
        """
        if shards < 1 or not 0 <= shard < shards:
            raise ValueError("shard must be between 0 and shards-1")
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                select external_id, url
                from listing
                where source_id = %s and status = 'active'
                  and (details_fetched_at is null or (
                      coalesce(photos_count,0) = 0
                      and details_fetched_at < now() - interval '1 day'))
                  and (%s = 1 or id %% %s = %s)
                  and not (external_id = any(%s::text[]))
                order by first_seen_at asc, id asc
                limit %s
                """,
                (source_id, shards, shards, shard, exclude_ids or [], limit),
            )
            rows = [{"external_id": r[0], "url": r[1]} for r in cur.fetchall()]
        self.conn.commit()
        return rows

    def _upsert_individually(self, prepared, existing, source_id, result, events):
        bad = 0
        for item, row in prepared:
            old = existing.get(row["external_id"])
            try:
                with self.conn.transaction(), self.conn.cursor() as cur:
                    if old is None:
                        cur.execute(INSERT_SQL, tuple(row[c] for c in COLUMNS) and (
                            source_id, row["external_id"], *(row[c] for c in COLUMNS)
                        ))
                        result.new_items.append(item)
                        result.inserted += 1
                    elif old[1] != row["content_hash"]:
                        cur.execute(
                            UPDATE_SQL,
                            tuple(row[c] for c in COLUMNS) + (source_id, row["external_id"]),
                        )
                        result.updated += 1
                    else:
                        cur.execute(
                            "update listing set last_seen_at = now() "
                            "where source_id = %s and external_id = %s",
                            (source_id, row["external_id"]),
                        )
                        result.unchanged += 1
            except Exception as exc:  # noqa: BLE001
                bad += 1
                result.rejected += 1
                with self.conn.transaction(), self.conn.cursor() as cur:
                    cur.execute(
                        "insert into ingest_reject (source_id, external_id, reason) "
                        "values (%s, %s, %s)",
                        (source_id, row["external_id"], f"db: {str(exc)[:150]}"),
                    )
        for ext, kind, old_price, new_price in events:
            with self.conn.transaction(), self.conn.cursor() as cur:
                cur.execute(
                    """
                    insert into listing_event (listing_id, kind, old_price, new_price)
                    select id, %s, %s, %s from listing
                    where source_id = %s and external_id = %s
                    """,
                    (kind, old_price, new_price, source_id, ext),
                )
        self.conn.commit()
        result.price_events = [
            {
                "external_id": ext,
                "kind": kind,
                "old_price": int(old_price),
                "new_price": int(new_price),
            }
            for ext, kind, old_price, new_price in events
        ]
        if bad:
            log.warning("отбраковано при построчной записи: %d", bad)
        return result

    @resilient
    def refresh_market(self, min_age_minutes: int = 360) -> bool:
        """Пересобирает модель рынка из активных объявлений.

        Таблица маленькая (единицы тысяч строк), поэтому честный delete+insert
        в одной транзакции: читатели видят либо старую, либо новую версию.
        Advisory lock не даёт трём шардам считать её одновременно.
        """
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(
                "select coalesce("
                "max(updated_at) < now() - make_interval(mins => %s), true"
                ") as stale from model_option",
                (min_age_minutes,),
            )
            if not cur.fetchone()[0]:
                return False
            # Защита от пустой/чужой базы: не затираем статистику нулём.
            cur.execute("select count(*) from listing where status = 'active'")
            if int(cur.fetchone()[0]) < 100:
                return False

        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute("select pg_try_advisory_lock(hashtext('carcar_market_refresh'))")
            if not cur.fetchone()[0]:
                return False
        try:
            with self.conn.transaction(), self.conn.cursor() as cur:
                cur.execute("delete from model_option")
                cur.execute(MARKET_SQL)
            return True
        finally:
            with (
                contextlib.suppress(Exception),
                self.conn.transaction(),
                self.conn.cursor() as cur,
            ):
                cur.execute(
                    "select pg_advisory_unlock(hashtext('carcar_market_refresh'))"
                )

    # -- состояние коллектора (Railway: у каждого свой контейнер) ----------
    @resilient
    def heartbeat(self, code: str, payload: dict[str, Any]) -> None:
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                insert into collector (source_id, status, heartbeat_at, interval_seconds,
                                       round, last_poll_at, last_error, stats, updated_at)
                values (%s, %s, now(), %s, %s, %s, %s, %s::jsonb, now())
                on conflict (source_id) do update set
                    status = excluded.status,
                    heartbeat_at = now(),
                    interval_seconds = excluded.interval_seconds,
                    round = excluded.round,
                    last_poll_at = excluded.last_poll_at,
                    last_error = excluded.last_error,
                    stats = coalesce(collector.stats, '{}'::jsonb) || excluded.stats,
                    updated_at = now()
                """,
                (
                    source_id,
                    payload.get("status", "unknown"),
                    int(payload.get("interval") or 60),
                    int(payload.get("round") or 0),
                    payload.get("last_poll_at"),
                    payload.get("last_error"),
                    json.dumps(payload.get("totals") or {}),
                ),
            )
        self.conn.commit()

    @resilient
    def collectors(self) -> list[dict[str, Any]]:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                select s.code, c.status, c.heartbeat_at, c.interval_seconds, c.round,
                       c.last_poll_at, c.last_error, c.stats, c.paused,
                       c.paused_reason, c.paused_at
                from source s left join collector c on c.source_id = s.id
                order by s.code
                """
            )
            rows = cur.fetchall()
        keys = (
            "source", "status", "heartbeat_at", "interval", "round", "last_poll_at",
            "last_error", "stats", "paused", "paused_reason", "paused_at",
        )
        return [dict(zip(keys, row, strict=False)) for row in rows]

    @resilient
    def set_paused(
        self, code: str, paused: bool, reason: str | None = None, by: str = "dashboard"
    ) -> None:
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                insert into collector (source_id, paused, paused_reason, paused_at, updated_at)
                values (%s, %s, %s, case when %s then now() end, now())
                on conflict (source_id) do update set
                    paused = excluded.paused,
                    paused_reason = excluded.paused_reason,
                    paused_at = case when excluded.paused then now() else null end,
                    updated_at = now()
                """,
                (source_id, paused, reason, paused),
            )
        self.conn.commit()

    @resilient
    def is_paused(self, code: str) -> tuple[bool, str | None]:
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                select coalesce(c.paused, false) or coalesce(
                           (c.stats #>> '{service_notice,starts_at}')::timestamptz <= now()
                           and (c.stats #>> '{service_notice,ends_at}')::timestamptz > now(),
                           false) as paused,
                       case when (c.stats #>> '{service_notice,starts_at}')::timestamptz <= now()
                                      and (c.stats #>> '{service_notice,ends_at}')::timestamptz
                                          > now()
                            then c.stats #>> '{service_notice,reason}'
                            else c.paused_reason end as reason
                from (select %s::smallint as source_id) requested
                left join collector c on c.source_id = requested.source_id
                """,
                (source_id,),
            )
            row = cur.fetchone()
        return (bool(row[0]), row[1]) if row else (False, None)

    @resilient
    def sweep_state(self, code: str) -> dict[str, Any]:
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                select next_page, total_pages, inserted, updated,
                       pass_started_at, completed_at, last_pages, last_errors
                from sweep_state
                where source_id = %s
                """,
                (source_id,),
            )
            row = cur.fetchone()
        if not row:
            return {
                "next_page": 1,
                "total_pages": None,
                "inserted": 0,
                "updated": 0,
                "pass_started_at": None,
                "completed_at": None,
                "last_pages": None,
                "last_errors": None,
            }
        return {
            "next_page": row[0],
            "total_pages": row[1],
            "inserted": row[2],
            "updated": row[3],
            "pass_started_at": row[4],
            "completed_at": row[5],
            "last_pages": row[6],
            "last_errors": row[7],
        }

    @resilient
    def begin_sweep_pass(self, code: str) -> datetime:
        """Начинает новый полный проход и возвращает его точку отсчёта.

        `pass_started_at` — граница «видели в этом проходе»: всё, что имеет
        `last_seen_at` меньше неё, в этом проходе не встретилось.
        """
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                insert into sweep_state (
                    source_id, next_page, total_pages, inserted, updated,
                    pass_started_at, completed_at, last_pages, last_errors, updated_at
                )
                values (%s, 1, null, 0, 0, now(), null, 0, 0, now())
                on conflict (source_id) do update set
                    next_page = 1,
                    total_pages = null,
                    inserted = 0,
                    updated = 0,
                    pass_started_at = now(),
                    completed_at = null,
                    last_pages = 0,
                    last_errors = 0,
                    updated_at = now()
                returning pass_started_at
                """,
                (source_id,),
            )
            row = cur.fetchone()
        self.conn.commit()
        return row[0]

    @resilient
    def complete_sweep_pass(
        self,
        code: str,
        *,
        pages: int,
        total_pages: int,
        errors: int,
        inserted: int,
        updated: int,
    ) -> None:
        """Фиксирует завершённый полный проход, не сбрасывая его точку отсчёта."""
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                update sweep_state
                set completed_at = now(),
                    last_pages = %s,
                    last_errors = %s,
                    inserted = %s,
                    updated = %s,
                    next_page = %s,
                    updated_at = now()
                where source_id = %s
                """,
                (pages, errors, inserted, updated, total_pages + 1, source_id),
            )
            if cur.rowcount == 0:
                cur.execute(
                    """
                    insert into sweep_state (
                        source_id, next_page, total_pages, inserted, updated,
                        pass_started_at, completed_at, last_pages, last_errors, updated_at
                    )
                    values (%s, %s, %s, %s, %s, now(), now(), %s, %s, now())
                    """,
                    (source_id, total_pages + 1, total_pages, inserted, updated, pages, errors),
                )
        self.conn.commit()

    @resilient
    def set_sweep_state(
        self,
        code: str,
        *,
        next_page: int,
        total_pages: int | None,
        inserted: int,
        updated: int,
    ) -> None:
        source_id = self.source_id(code)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                insert into sweep_state (
                    source_id, next_page, total_pages, inserted, updated, updated_at
                )
                values (%s, %s, %s, %s, %s, now())
                on conflict (source_id) do update set
                    next_page = excluded.next_page,
                    total_pages = excluded.total_pages,
                    inserted = excluded.inserted,
                    updated = excluded.updated,
                    updated_at = now()
                """,
                (source_id, next_page, total_pages, inserted, updated),
            )
        self.conn.commit()

    # -- наблюдаемость -----------------------------------------------------
    @resilient
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

    @resilient
    def stats(self) -> dict[str, Any]:
        with self.conn.cursor() as cur:
            cur.execute("select count(*) from listing")
            total = cur.fetchone()[0]
            cur.execute("select count(*) from listing where status = 'active'")
            active = cur.fetchone()[0]
            cur.execute("select count(*) from listing where status = 'removed'")
            removed = cur.fetchone()[0]
            cur.execute("select count(*) from listing_lifecycle")
            lifecycle = cur.fetchone()[0]
            cur.execute("select count(*) from listing_event")
            events = cur.fetchone()[0]
            cur.execute("select pg_size_pretty(pg_total_relation_size('listing'))")
            size = cur.fetchone()[0]
        return {
            "total": total,
            "active": active,
            "removed": removed,
            "lifecycle": lifecycle,
            "events": events,
            "listing_size": size,
        }

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> DatabaseSink:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
