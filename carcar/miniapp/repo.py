"""Данные для Mini App: поиск объявлений, пользователи, подписки, избранное."""

from __future__ import annotations

import json
import math
import re
from datetime import datetime
from typing import Any

from .price_model import analyse_price

DISTANCE_SQL = """
6371 * 2 * asin(least(1.0, sqrt(
    power(sin(radians(l.lat - %(lat)s) / 2), 2) +
    cos(radians(%(lat)s)) * cos(radians(l.lat)) *
    power(sin(radians(l.lon - %(lon)s) / 2), 2)
)))
"""

FIELDS = """
    l.id, l.external_id, l.url, l.title, l.price, l.currency, l.make, l.model,
    l.year, l.mileage_km, l.fuel, l.gearbox, l.body, l.power_hp, l.engine_cm3,
    l.color, l.vin, l.city, l.region, l.lat, l.lon, l.seller_type, l.seller_name,
    l.description, l.version, l.generation, l.doors, l.seats, l.drive, l.condition,
    l.co2_gkm, l.consumption_urban, l.consumption_extra, l.equipment,
    l.thumb_url, l.photos, l.photos_count, l.published_at, l.first_seen_at,
    l.last_seen_at, l.status
"""

# Для выдачи не тащим описание и оборудование: это мегабайты лишнего I/O.
LIST_FIELDS = """
    l.id, l.external_id, l.url, l.title, l.price, l.currency, l.make, l.model,
    l.year, l.mileage_km, l.fuel, l.gearbox, l.body, l.power_hp, l.engine_cm3,
    l.color, l.vin, l.city, l.region, l.lat, l.lon, l.seller_type, l.seller_name,
    l.version, l.generation, l.doors, l.seats, l.drive, l.condition,
    l.thumb_url, l.photos, l.photos_count, l.published_at, l.first_seen_at,
    l.last_seen_at, l.status
"""


def _flt(value: Any) -> float | None:
    return float(value) if value is not None else None


def _num(value: Any) -> int | None:
    return None if value is None else int(value)


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else value


def _item(row: dict[str, Any]) -> dict[str, Any]:
    photos = [photo for photo in (row.get("photos") or []) if photo]
    if not photos and row.get("thumb_url"):
        photos = [row["thumb_url"]]
    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "source": row.get("source_code"),
        "title": row["title"],
        "price": _num(row.get("price")),
        "currency": (row.get("currency") or "PLN").strip(),
        "make": row.get("make"),
        "model": row.get("model"),
        "year": row.get("year"),
        "mileage_km": row.get("mileage_km"),
        "fuel": row.get("fuel"),
        "gearbox": row.get("gearbox"),
        "body": row.get("body"),
        "power_hp": row.get("power_hp"),
        "engine_cm3": row.get("engine_cm3"),
        "city": row.get("city"),
        "region": row.get("region"),
        "lat": row.get("lat"),
        "lon": row.get("lon"),
        "seller_type": row.get("seller_type"),
        "drive": row.get("drive"),
        "condition": row.get("condition"),
        "version": row.get("version"),
        "generation": row.get("generation"),
        "color": row.get("color"),
        "doors": row.get("doors"),
        "seats": row.get("seats"),
        "thumbnail": row.get("thumb_url"),
        "photos": photos[:6],
        "photos_count": row.get("photos_count") or 0,
        "published_at": _iso(row.get("published_at")),
        "distance_km": round(row["distance_km"], 1)
        if row.get("distance_km") is not None
        else None,
    }


def _card(
    row: dict[str, Any],
    events: list[dict[str, Any]],
    analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    photos = [p for p in (row.get("photos") or []) if p] or (
        [row["thumb_url"]] if row.get("thumb_url") else []
    )
    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "source": row.get("source_code"),
        "url": row["url"],
        "title": row["title"],
        "price": _num(row.get("price")),
        "currency": (row.get("currency") or "PLN").strip(),
        "photos": photos[:60],
        "description": row.get("description") or "",
        "seller": {
            "type": "dealer"
            if row.get("seller_type") == "dealer"
            else ("private" if row.get("seller_type") == "private" else None),
            "name": row.get("seller_name") or "",
        },
        "city": row.get("city") or "",
        "region": row.get("region") or "",
        "created_at": _iso(row.get("published_at")),
        "year": row.get("year"),
        "mileage_km": row.get("mileage_km"),
        "engine_cm3": row.get("engine_cm3"),
        "power_hp": row.get("power_hp"),
        "make": row.get("make"),
        "model": row.get("model"),
        "fuel": row.get("fuel"),
        "gearbox": row.get("gearbox"),
        "body": row.get("body") or "",
        "color": row.get("color") or "",
        "vin": row.get("vin") or "",
        "lat": row.get("lat"),
        "lon": row.get("lon"),
        "events": events,
        "first_seen_at": _iso(row.get("first_seen_at")),
        "price_analysis": analysis,
        "version": row.get("version") or "",
        "generation": row.get("generation") or "",
        "doors": row.get("doors"),
        "seats": row.get("seats"),
        "drive": row.get("drive"),
        "condition": row.get("condition"),
        "co2_gkm": row.get("co2_gkm"),
        "consumption_urban": _flt(row.get("consumption_urban")),
        "consumption_extra": _flt(row.get("consumption_extra")),
        "equipment": list(row.get("equipment") or []),
    }


BODY_HINTS = (
    ("suv", ("suv", "внедорожник", "кроссовер", "crossover", "terenowy")),
    ("kombi", ("kombi", "универсал", "wagon", "estate")),
    ("sedan", ("sedan", "седан", "limuzyna")),
    ("hatchback", ("hatchback", "хэтчбек", "хетчбек")),
    ("coupe", ("coupe", "купе")),
    ("cabrio", ("cabrio", "кабриолет", "convertible")),
    ("minivan", ("minivan", "минивэн")),
    ("pickup", ("pickup", "пикап")),
)

COLOR_RE = re.compile(
    r"(?:kolor|color|колір|цвет)\s*[:\-]\s*([^\W\d_]+(?:\s+[^\W\d_]+)?)",
    re.IGNORECASE,
)


def _infer_subject_features(row: dict[str, Any]) -> dict[str, Any]:
    """Кузов/цвет часто пустые в строке — добираем из описания."""
    subject = dict(row)
    description = str(subject.get("description") or "")
    if not subject.get("body"):
        text = f"{subject.get('title') or ''} {description}".lower()
        for body, hints in BODY_HINTS:
            if any(hint in text for hint in hints):
                subject["body"] = body
                break
    if not subject.get("color"):
        match = COLOR_RE.search(description)
        if match:
            subject["color"] = match.group(1).strip()[:40]
    return subject


class MiniAppRepo:
    def __init__(self, url: str) -> None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        if "ljkugtpeboomboobodom" in url.lower():
            raise RuntimeError("это складская эко-система — Mini App сюда не подключаем")
        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=10,
            open=True,
            kwargs={
                "connect_timeout": 10,
                "row_factory": dict_row,
                "prepare_threshold": None,
            },
            # transaction pooler рвёт простаивающие соединения — проверяем при выдаче
            check=ConnectionPool.check_connection,
            max_idle=60,
        )

    def close(self) -> None:
        self.pool.close()

    # -- пользователи ------------------------------------------------------
    def ensure_user(self, tg: dict[str, Any]) -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into app_user (tg_id, username, first_name, last_name)
                values (%s, %s, %s, %s)
                on conflict (tg_id) do update set
                    username = excluded.username,
                    first_name = excluded.first_name,
                    last_name = excluded.last_name,
                    last_seen_at = now()
                returning id, tg_id, username, first_name, last_name,
                          lang, notify_new, digest, created_at
                """,
                (
                    tg["id"],
                    tg.get("username"),
                    tg.get("first_name"),
                    tg.get("last_name"),
                ),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row)

    def get_user(self, user_id: int) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select id, tg_id, username, first_name, last_name, lang,
                       notify_new, digest, created_at
                from app_user where id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
        return dict(row) if row else None

    def update_user(self, user_id: int, **fields: Any) -> dict[str, Any]:
        allowed = {"lang", "notify_new", "digest"}
        updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
        if updates:
            assignments = ", ".join(f"{key} = %({key})s" for key in updates)
            updates["user_id"] = user_id
            with self.pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    f"update app_user set {assignments}, last_seen_at = now() "
                    "where id = %(user_id)s",
                    updates,
                )
            conn.commit()
        return self.get_user(user_id) or {}

    # -- объявления ----------------------------------------------------------
    def _market_analyses(
        self, rows: list[dict[str, Any]]
    ) -> dict[int, dict[str, Any]]:
        """Быстрая оценка рынка из предрасчитанного model_option.

        Точный percentile по всей таблице считается только в карточке
        объявления. Для ленты 20 таких запросов слишком дорогие, поэтому
        берём медиану/перцентили из model_option (те же модели и годы)
        и взвешиваем по числу объявлений в группах. Это ~0.06 c на 20 машин.
        """
        ids = [
            row["id"]
            for row in rows
            if row.get("price") and row.get("make") and row.get("model")
        ]
        if not ids:
            return {}

        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                with page as (
                    select id, make, model, year, gearbox, fuel, body
                    from listing
                    where id = any(%(ids)s::bigint[])
                )
                select p.id,
                       sum(o.price_median * o.listings)::numeric
                           / nullif(sum(o.listings), 0) as median,
                       sum(o.price_p10 * o.listings)::numeric
                           / nullif(sum(o.listings), 0) as p10,
                       sum(o.price_p90 * o.listings)::numeric
                           / nullif(sum(o.listings), 0) as p90,
                       sum(o.listings) as sample
                from page p
                join model_option o
                  on o.make = p.make
                 and o.model = p.model
                 and (p.year is null or p.year between o.year_min and o.year_max)
                 and (p.gearbox is null or o.gearbox = p.gearbox)
                 and (p.fuel is null or o.fuel = p.fuel)
                 and (p.body is null or o.body = p.body or o.body = '')
                group by p.id
                """,
                {"ids": ids},
            )
            stats = cur.fetchall()
        prices = {row["id"]: row["price"] for row in rows}
        result: dict[int, dict[str, Any]] = {}
        for stat in stats:
            median = _num(stat["median"])
            sample = int(stat["sample"] or 0)
            price = prices.get(stat["id"])
            if not median or sample < 5 or price is None:
                continue
            diff = round((price - median) / median * 100)
            result[stat["id"]] = {
                "median": median,
                "p10": _num(stat["p10"]),
                "p90": _num(stat["p90"]),
                "sample": sample,
                "diff_pct": diff,
                "verdict": "below" if diff <= -5 else ("above" if diff >= 5 else "fair"),
            }
        return result

    def search(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        q: str | None = None,
        make: str | None = None,
        model: str | None = None,
        price_min: int | None = None,
        price_max: int | None = None,
        year_min: int | None = None,
        year_max: int | None = None,
        mileage_min: int | None = None,
        mileage_max: int | None = None,
        fuel: str | None = None,
        gearbox: str | None = None,
        body: str | None = None,
        drive: str | None = None,
        condition: str | None = None,
        seller_type: str | None = None,
        color: str | None = None,
        doors: int | None = None,
        seats: int | None = None,
        power_min: int | None = None,
        power_max: int | None = None,
        engine_min: int | None = None,
        engine_max: int | None = None,
        source: str | None = None,
        lat: float | None = None,
        lon: float | None = None,
        radius_km: float | None = None,
        sort: str = "new",
    ) -> tuple[list[dict[str, Any]], int, bool]:
        limit = max(1, min(limit, 50))
        offset = max(0, offset)
        # Без published_at is not null PostgreSQL не может идти по
        # listing_active_published_idx для sort=new и сканирует всю таблицу.
        conds = ["l.status = 'active'", "l.published_at is not null"]
        # радиус имеет смысл только вместе с координатами
        params: dict[str, Any] = {"limit": limit, "offset": offset, "radius": None}

        if q:
            conds.append("(l.title ILIKE %(q)s OR l.make ILIKE %(q)s OR l.model ILIKE %(q)s)")
            params["q"] = f"%{q}%"
        if make:
            # Значение приходит из выпадающего списка — сравниваем точно, индекс работает.
            conds.append("l.make = %(make)s")
            params["make"] = make
        if model:
            conds.append("l.model = %(model)s")
            params["model"] = model
        if price_min is not None:
            conds.append("l.price >= %(price_min)s")
            params["price_min"] = price_min
        if price_max is not None:
            conds.append("l.price <= %(price_max)s")
            params["price_max"] = price_max
        if year_min is not None:
            conds.append("l.year >= %(year_min)s")
            params["year_min"] = year_min
        if year_max is not None:
            conds.append("l.year <= %(year_max)s")
            params["year_max"] = year_max
        if mileage_min is not None:
            conds.append("l.mileage_km >= %(mileage_min)s")
            params["mileage_min"] = mileage_min
        if mileage_max is not None:
            conds.append("l.mileage_km <= %(mileage_max)s")
            params["mileage_max"] = mileage_max
        if fuel:
            conds.append("l.fuel = %(fuel)s")
            params["fuel"] = fuel
        if gearbox:
            conds.append("l.gearbox = %(gearbox)s")
            params["gearbox"] = gearbox
        if body:
            conds.append("l.body = %(body)s")
            params["body"] = body
        if drive:
            conds.append("l.drive = %(drive)s")
            params["drive"] = drive
        if condition:
            conds.append("l.condition = %(condition)s")
            params["condition"] = condition
        if seller_type:
            conds.append("l.seller_type = %(seller_type)s")
            params["seller_type"] = seller_type
        if color:
            conds.append("l.color = %(color)s")
            params["color"] = color
        if doors:
            conds.append("l.doors = %(doors)s")
            params["doors"] = doors
        if seats:
            conds.append("l.seats = %(seats)s")
            params["seats"] = seats
        if power_min is not None:
            conds.append("l.power_hp >= %(power_min)s")
            params["power_min"] = power_min
        if power_max is not None:
            conds.append("l.power_hp <= %(power_max)s")
            params["power_max"] = power_max
        if engine_min is not None:
            conds.append("l.engine_cm3 >= %(engine_min)s")
            params["engine_min"] = engine_min
        if engine_max is not None:
            conds.append("l.engine_cm3 <= %(engine_max)s")
            params["engine_max"] = engine_max
        if source:
            # exists вместо join: count-запрос не тащит join в source и
            # может идти по partial-индексу listing_active_published_idx.
            conds.append(
                "exists (select 1 from source s2 "
                "where s2.id = l.source_id and s2.code = %(source)s)"
            )
            params["source"] = source

        distance = "null::float8"
        if lat is not None and lon is not None:
            params.update(lat=lat, lon=lon)
            distance = f"({DISTANCE_SQL})"
            if radius_km:
                params["radius"] = radius_km
                dlat = radius_km / 111.0
                dlon = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.05))
                params.update(
                    lat_min=lat - dlat,
                    lat_max=lat + dlat,
                    lon_min=lon - dlon,
                    lon_max=lon + dlon,
                )
                conds.append(
                    "l.lat between %(lat_min)s and %(lat_max)s "
                    "and l.lon between %(lon_min)s and %(lon_max)s"
                )

        order = {
            "new": "published_at desc",
            "price_asc": "price asc",
            "price_desc": "price desc",
            "distance": "distance_km nulls last",
        }.get(sort, "published_at desc")

        where = " and ".join(conds)
        # Без гео не добавляем OR с NULL-параметром: иначе планировщик
        # перестаёт брать индекс published_at и простой список ползёт минутами.
        radius_cond = ""
        if radius_km and lat is not None and lon is not None:
            radius_cond = f" and {distance} <= %(radius)s::float8"
        items_sql = f"""
            select {LIST_FIELDS}, s.code as source_code, {distance} as distance_km
            from listing l join source s on s.id = l.source_id
            where {where}{radius_cond}
            order by {order}
            limit %(limit)s offset %(offset)s
        """
        # Точный count(*) на этой базе слишком дорогой и валит пул соединений.
        # Для пустой выдачи берём оценку из partial-индекса, для фильтров —
        # нижнюю границу по загруженной странице; фронт показывает «N+».
        estimate = 0
        filtered = len(conds) > 2
        with self.pool.connection() as conn, conn.cursor() as cur:
            if not filtered:
                cur.execute(
                    "select reltuples::bigint as n from pg_class "
                    "where relname = 'listing_active_published_idx'"
                )
                row = cur.fetchone()
                estimate = int(row["n"] or 0) if row else 0
            cur.execute(items_sql, params)
            rows = cur.fetchall()

        if len(rows) < limit:
            total = offset + len(rows)
            approx = False
        elif not filtered:
            total = max(estimate, offset + len(rows) + limit)
            approx = True
        else:
            total = offset + len(rows) + limit
            approx = True

        items = [_item(row) for row in rows]
        analyses: dict[int, dict[str, Any]] = {}
        # limit=1 — это запрос счётчика для фильтров; анализ рынка там не нужен.
        if limit > 1:
            try:
                analyses = self._market_analyses(rows)
            except Exception:
                # Оценка рынка вспомогательная: без неё выдача всё равно должна открыться.
                analyses = {}
        for item in items:
            analysis = analyses.get(item["id"])
            if analysis:
                item["price_analysis"] = analysis

        return items, total, approx

    def apply_detail(self, listing_id: int, values: dict[str, Any]) -> None:
        values = dict(values)
        for key, low, high in (
            ("power_hp", 10, 2000),
            ("engine_cm3", 600, 10_000),
            ("doors", 1, 20),
            ("seats", 1, 100),
            ("co2_gkm", 0, 2000),
        ):
            value = values.get(key)
            if value is None:
                continue
            try:
                number = int(value)
            except (TypeError, ValueError):
                values[key] = None
                continue
            values[key] = number if low <= number <= high else None
        tags = [tag for tag in (values.get("equipment") or []) if tag][:120]
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                update listing set
                    description = coalesce(%(description)s, description),
                    version = coalesce(%(version)s, version),
                    generation = coalesce(%(generation)s, generation),
                    body = coalesce(%(body)s, body),
                    color = coalesce(%(color)s, color),
                    fuel = coalesce(%(fuel)s, fuel),
                    gearbox = coalesce(%(gearbox)s, gearbox),
                    engine_cm3 = coalesce(%(engine_cm3)s, engine_cm3),
                    power_hp = coalesce(%(power_hp)s, power_hp),
                    doors = coalesce(%(doors)s, doors),
                    seats = coalesce(%(seats)s, seats),
                    drive = coalesce(%(drive)s, drive),
                    condition = coalesce(%(condition)s, condition),
                    co2_gkm = coalesce(%(co2_gkm)s, co2_gkm),
                    consumption_urban = coalesce(%(consumption_urban)s, consumption_urban),
                    consumption_extra = coalesce(%(consumption_extra)s, consumption_extra),
                    equipment = case when cardinality(%(tags)s::text[]) > 0
                                     then %(tags)s::text[] else equipment end,
                    vin = coalesce(%(vin)s, vin),
                    details_fetched_at = now(),
                    updated_at = now()
                where id = %(id)s
                """,
                {"id": listing_id, "tags": tags, **values},
            )
        conn.commit()

    def set_description(self, listing_id: int, text: str) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update listing set description = %s where id = %s and description is null",
                (text[:2000], listing_id),
            )
        conn.commit()

    def _price_analysis(self, cur: Any, row: dict[str, Any]) -> dict[str, Any] | None:
        if not row.get("price") or not row.get("make") or not row.get("model"):
            return None

        fields = """
            l.id, l.title, l.price, l.year, l.mileage_km, l.engine_cm3,
            l.power_hp, l.body, l.gearbox, l.drive, l.fuel, l.color,
            l.generation, l.equipment
        """
        base = [
            "l.status = 'active'",
            "l.price is not null",
            "l.id <> %(id)s",
            "l.make = %(make)s",
            "l.model = %(model)s",
        ]
        base_params: dict[str, Any] = {
            "id": row["id"],
            "make": row["make"],
            "model": row["model"],
        }
        params = dict(base_params)
        conds = list(base)
        year = row.get("year")
        mileage = row.get("mileage_km")
        if year:
            params["year_lo"] = int(year) - 6
            params["year_hi"] = int(year) + 6
            conds.append("l.year between %(year_lo)s and %(year_hi)s")
        if mileage:
            params["mile_lo"] = int(mileage * 0.4)
            params["mile_hi"] = int(mileage * 1.8)
            conds.append("l.mileage_km between %(mile_lo)s and %(mile_hi)s")
        cur.execute(
            f"select {fields} from listing l where {' and '.join(conds)} limit 60",
            params,
        )
        comps = cur.fetchall()
        if len(comps) < 8:
            cur.execute(
                f"select {fields} from listing l where {' and '.join(base)} limit 60",
                base_params,
            )
            comps = cur.fetchall()
        return analyse_price(_infer_subject_features(row), comps)

    def get_listing(self, listing_id: int) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select {FIELDS}, s.code as source_code
                from listing l join source s on s.id = l.source_id
                where l.id = %s
                """,
                (listing_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cur.execute(
                """
                select kind, old_price, new_price, observed_at
                from listing_event where listing_id = %s
                order by observed_at desc limit 10
                """,
                (listing_id,),
            )
            events = [
                {
                    "kind": e["kind"],
                    "old_price": _num(e["old_price"]),
                    "new_price": _num(e["new_price"]),
                    "observed_at": _iso(e["observed_at"]),
                }
                for e in cur.fetchall()
            ]

        needs_details = (
            not row.get("description")
            or not row.get("equipment")
            or not row.get("drive")
            or not row.get("condition")
            or not row.get("doors")
            or not row.get("color")
            or not row.get("body")
        )
        if needs_details and row.get("url"):
            # Карточка скачана раньше без полного набора полей — добираем лениво.
            try:
                from ..client import Client
                from ..config import Settings
                from ..parse import _to_int, parse_offer

                client = Client(Settings())
                offer = parse_offer(client.get(row["url"]).text, row["url"])
                details = offer.details or {}
                values = {
                    "description": (offer.description or "").strip()[:2000] or None,
                    "version": offer.version or None,
                    "generation": offer.generation or None,
                    "body": details.get("body_type") or None,
                    "color": details.get("color") or None,
                    "fuel": details.get("fuel_type") or None,
                    "gearbox": details.get("gearbox") or None,
                    "engine_cm3": _to_int(details.get("engine_capacity")),
                    "power_hp": _to_int(details.get("engine_power")),
                    "doors": offer.doors,
                    "seats": offer.seats,
                    "drive": offer.drive,
                    "condition": offer.condition,
                    "co2_gkm": offer.co2_gkm,
                    "consumption_urban": offer.consumption_urban,
                    "consumption_extra": offer.consumption_extra,
                    "equipment": offer.equipment or [],
                    "vin": (offer.details.get("vin") or "").strip().upper() or None,
                }
                self.apply_detail(listing_id, values)
                row.update({key: value for key, value in values.items() if value is not None})
            except Exception:
                pass

        inferred = _infer_subject_features(row)
        row.update(
            {
                key: inferred[key]
                for key in ("body", "color")
                if inferred.get(key) and not row.get(key)
            }
        )

        analysis = None
        if row.get("price") and row.get("make") and row.get("model"):
            # Считаем после ленивой догрузки: иначе кузов, привод и
            # комплектация в отчёте были бы пустыми.
            with self.pool.connection() as conn, conn.cursor() as cur:
                analysis = self._price_analysis(cur, row)

        return _card(row, events, analysis)

    # -- просмотры, реакции, популярность -----------------------------------
    def record_view(self, user_id: int, listing_id: int) -> int:
        """Один просмотр в день на пользователя; возвращает всего просмотров."""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into listing_view (user_id, listing_id) values (%s, %s) "
                "on conflict do nothing returning 1",
                (user_id, listing_id),
            )
            fresh = cur.fetchone()
            if fresh:
                cur.execute(
                    """
                    insert into listing_stat (listing_id, views, score)
                    values (%s, 1, 1)
                    on conflict (listing_id) do update set
                        views = listing_stat.views + 1,
                        score = (listing_stat.views + 1)
                              + 3 * listing_stat.likes
                              + 5 * listing_stat.comments
                              + 2 * listing_stat.reposts,
                        updated_at = now()
                    returning views
                    """,
                    (listing_id,),
                )
                views = int(cur.fetchone()["views"])
            else:
                cur.execute(
                    "select views from listing_stat where listing_id = %s", (listing_id,)
                )
                row = cur.fetchone()
                views = int(row["views"]) if row else 0
        conn.commit()
        return views

    def like(self, user_id: int, listing_id: int, on: bool) -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            if on:
                cur.execute(
                    "insert into listing_reaction (user_id, listing_id, kind) "
                    "values (%s, %s, 'like') on conflict do nothing returning 1",
                    (user_id, listing_id),
                )
                fresh = cur.fetchone()
                if fresh:
                    cur.execute(
                        """
                        insert into listing_stat (listing_id, likes, score)
                        values (%s, 1, 3)
                        on conflict (listing_id) do update set
                            likes = listing_stat.likes + 1,
                            score = listing_stat.views
                                  + 3 * (listing_stat.likes + 1)
                                  + 5 * listing_stat.comments
                                  + 2 * listing_stat.reposts,
                            updated_at = now()
                        """,
                        (listing_id,),
                    )
            else:
                cur.execute(
                    "delete from listing_reaction where user_id = %s and listing_id = %s "
                    "and kind = 'like'",
                    (user_id, listing_id),
                )
                if cur.rowcount:
                    cur.execute(
                        """
                        update listing_stat set
                            likes = greatest(likes - 1, 0),
                            score = views
                                  + 3 * greatest(likes - 1, 0)
                                  + 5 * comments
                                  + 2 * reposts,
                            updated_at = now()
                        where listing_id = %s
                        """,
                        (listing_id,),
                    )
            cur.execute(
                "select likes from listing_stat where listing_id = %s", (listing_id,)
            )
            row = cur.fetchone()
        conn.commit()
        return {"likes": int(row["likes"]) if row else 0, "liked": on}

    def repost(self, user_id: int, listing_id: int) -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into listing_reaction (user_id, listing_id, kind) "
                "values (%s, %s, 'repost') on conflict do nothing returning 1",
                (user_id, listing_id),
            )
            fresh = cur.fetchone()
            if fresh:
                cur.execute(
                    """
                    insert into listing_stat (listing_id, reposts, score)
                    values (%s, 1, 2)
                    on conflict (listing_id) do update set
                        reposts = listing_stat.reposts + 1,
                        score = listing_stat.views
                              + 3 * listing_stat.likes
                              + 5 * listing_stat.comments
                              + 2 * (listing_stat.reposts + 1),
                        updated_at = now()
                    """,
                    (listing_id,),
                )
            cur.execute(
                "select reposts from listing_stat where listing_id = %s", (listing_id,)
            )
            row = cur.fetchone()
        conn.commit()
        return {"reposts": int(row["reposts"]) if row else 0}

    def add_comment(self, user_id: int, listing_id: int, text: str) -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into listing_comment (user_id, listing_id, text) "
                "values (%s, %s, %s) returning id, created_at",
                (user_id, listing_id, text[:1000]),
            )
            row = cur.fetchone()
            cur.execute(
                """
                insert into listing_stat (listing_id, comments, score)
                values (%s, 1, 5)
                on conflict (listing_id) do update set
                    comments = listing_stat.comments + 1,
                    score = listing_stat.views
                          + 3 * listing_stat.likes
                          + 5 * (listing_stat.comments + 1)
                          + 2 * listing_stat.reposts,
                    updated_at = now()
                """,
                (listing_id,),
            )
            cur.execute(
                "select coalesce(first_name, username, '') as name from app_user where id = %s",
                (user_id,),
            )
            who = cur.fetchone()
        conn.commit()
        return {
            "id": row["id"],
            "text": text[:1000],
            "author": (who["name"] if who else "") or "",
            "created_at": _iso(row["created_at"]),
        }

    def comments(self, listing_id: int, limit: int = 50) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select c.id, c.text, c.created_at,
                       coalesce(u.first_name, u.username, '') as author
                from listing_comment c join app_user u on u.id = c.user_id
                where c.listing_id = %s order by c.created_at desc limit %s
                """,
                (listing_id, min(limit, 100)),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "text": r["text"],
                "author": r["author"] or "",
                "created_at": _iso(r["created_at"]),
            }
            for r in rows
        ]

    def _taste(self, conn, user_id: int) -> dict[str, Any]:
        """Вкус пользователя: сохранённые фильтры + просмотры + лайки."""
        makes: dict[str, int] = {}
        bodies: dict[str, int] = {}
        fuels: dict[str, int] = {}
        price_min: int | None = None
        price_max: int | None = None

        with conn.cursor() as cur:
            cur.execute(
                "select criteria from subscription where user_id = %s and active", (user_id,)
            )
            for row in cur.fetchall():
                criteria = row["criteria"] or {}
                if criteria.get("make"):
                    makes[criteria["make"]] = makes.get(criteria["make"], 0) + 3
                if criteria.get("body"):
                    bodies[criteria["body"]] = bodies.get(criteria["body"], 0) + 3
                if criteria.get("fuel"):
                    fuels[criteria["fuel"]] = fuels.get(criteria["fuel"], 0) + 2
                if criteria.get("price_min") is not None:
                    price_min = max(price_min or 0, int(criteria["price_min"]))
                if criteria.get("price_max") is not None:
                    price_max = int(criteria["price_max"]) if price_max is None else max(price_max, int(criteria["price_max"]))

            cur.execute(
                """
                select l.make, l.body, l.fuel
                from listing_view v join listing l on l.id = v.listing_id
                where v.user_id = %s order by v.created_at desc limit 80
                """,
                (user_id,),
            )
            for row in cur.fetchall():
                if row["make"]:
                    makes[row["make"]] = makes.get(row["make"], 0) + 2
                if row["body"]:
                    bodies[row["body"]] = bodies.get(row["body"], 0) + 2
                if row["fuel"]:
                    fuels[row["fuel"]] = fuels.get(row["fuel"], 0) + 1

            cur.execute(
                """
                select l.make, l.body, l.fuel
                from listing_reaction r join listing l on l.id = r.listing_id
                where r.user_id = %s and r.kind = 'like'
                order by r.created_at desc limit 50
                """,
                (user_id,),
            )
            for row in cur.fetchall():
                if row["make"]:
                    makes[row["make"]] = makes.get(row["make"], 0) + 4
                if row["body"]:
                    bodies[row["body"]] = bodies.get(row["body"], 0) + 3
                if row["fuel"]:
                    fuels[row["fuel"]] = fuels.get(row["fuel"], 0) + 2

        top_makes = [m for m, _ in sorted(makes.items(), key=lambda kv: -kv[1])[:6]]
        top_bodies = [b for b, _ in sorted(bodies.items(), key=lambda kv: -kv[1])[:3]]
        top_fuels = [f for f, _ in sorted(fuels.items(), key=lambda kv: -kv[1])[:2]]
        return {
            "makes": top_makes,
            "bodies": top_bodies,
            "fuels": top_fuels,
            "price_min": price_min,
            "price_max": price_max,
        }

    def feed(
        self,
        user_id: int | None = None,
        *,
        mode: str = "for_you",
        limit: int = 10,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        limit = max(1, min(limit, 30))
        with self.pool.connection() as conn, conn.cursor() as cur:
            params: dict[str, Any] = {"limit": limit, "offset": max(0, offset)}
            conds = ["l.status = 'active'", "l.thumb_url is not null"]
            taste = None
            if mode == "for_you" and user_id:
                taste = self._taste(conn, user_id)
                if taste["makes"]:
                    conds.append("l.make = ANY(%(makes)s)")
                    params["makes"] = taste["makes"]
                elif taste["bodies"]:
                    conds.append("l.body = ANY(%(bodies)s)")
                    params["bodies"] = taste["bodies"]
                if taste["price_min"] or taste["price_max"]:
                    lo = taste["price_min"] or 0
                    hi = taste["price_max"] or 10_000_000
                    conds.append("l.price between %(lo)s and %(hi)s")
                    params["lo"] = lo
                    params["hi"] = hi
                if user_id:
                    conds.append(
                        "not exists (select 1 from listing_view v "
                        "where v.user_id = %(uid)s and v.listing_id = l.id)"
                    )
                    params["uid"] = user_id
            order = (
                "coalesce(st.score, 0) desc, l.published_at desc nulls last"
                if mode == "popular" or not taste or not (taste["makes"] or taste["bodies"])
                else "l.published_at desc nulls last, coalesce(st.score, 0) desc"
            )
            sql = f"""
                select {LIST_FIELDS}, s.code as source_code,
                       coalesce(st.views, 0) views,
                       coalesce(st.likes, 0) likes,
                       coalesce(st.comments, 0) comments,
                       coalesce(st.reposts, 0) reposts
                from listing l
                join source s on s.id = l.source_id
                left join listing_stat st on st.listing_id = l.id
                where {' and '.join(conds)}
                order by {order}
                limit %(limit)s offset %(offset)s
            """
            cur.execute(sql, params)
            rows = cur.fetchall()

        items = []
        for row in rows:
            item = _item(row)
            item.update(
                views=int(row["views"]),
                likes=int(row["likes"]),
                comments=int(row["comments"]),
                reposts=int(row["reposts"]),
            )
            items.append(item)
        if rows:
            try:
                analyses = self._market_analyses(rows)
            except Exception:
                analyses = {}
            for item in items:
                analysis = analyses.get(item["id"])
                if analysis:
                    item["price_analysis"] = analysis
        return items

    # -- справочник для фильтров --------------------------------------------
    def filter_makes(self) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select make, count(*) as n
                from listing
                where status = 'active' and make is not null and make <> ''
                group by make
                having count(*) >= 3
                order by n desc
                """
            )
            return [{"value": r["make"], "count": r["n"]} for r in cur.fetchall()]

    def filter_models(self, make: str) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select model, count(*) as n
                from listing
                where status = 'active' and make = %s and model is not null and model <> ''
                group by model
                order by n desc
                """,
                (make,),
            )
            return [{"value": r["model"], "count": r["n"]} for r in cur.fetchall()]

    def filter_cities(self, q: str | None = None, limit: int = 120) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select city,
                       round(avg(lat)::numeric, 4)::float8 as lat,
                       round(avg(lon)::numeric, 4)::float8 as lon,
                       count(*) as n
                from listing
                where status = 'active' and city is not null and city <> ''
                  and lat is not null and lon is not null
                  and (%s::text is null or city ilike %s)
                group by city
                order by n desc
                limit %s
                """,
                (q, f"%{q}%" if q else None, limit),
            )
            return [
                {"value": r["city"], "lat": r["lat"], "lon": r["lon"], "count": int(r["n"])}
                for r in cur.fetchall()
            ]

    def filter_options(self, make: str | None, model: str | None) -> dict[str, Any]:
        where, params = [], []
        if make:
            where.append("make = %s")
            params.append(make)
        if model:
            where.append("model = %s")
            params.append(model)
        clause = ("where " + " and ".join(where)) if where else ""

        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select gearbox, sum(listings) as n from model_option {clause}
                group by gearbox having gearbox <> '' order by n desc
                """,
                params,
            )
            gearboxes = [{"value": r["gearbox"], "count": int(r["n"])} for r in cur.fetchall()]

            cur.execute(
                f"""
                select fuel, sum(listings) as n from model_option {clause}
                group by fuel having fuel <> '' order by n desc
                """,
                params,
            )
            fuels = [{"value": r["fuel"], "count": int(r["n"])} for r in cur.fetchall()]

            cur.execute(
                f"""
                select body, sum(listings) as n from model_option {clause}
                group by body having body <> '' order by n desc
                """,
                params,
            )
            bodies = [{"value": r["body"], "count": int(r["n"])} for r in cur.fetchall()]

            model_clause = (
                "where status = 'active'"
                " and (%s::text is null or make = %s)"
                " and (%s::text is null or model = %s)"
            )
            model_params = (make, make, model, model)

            cur.execute(
                f"""
                select drive, count(*) as n from listing {model_clause}
                  and drive is not null and drive <> ''
                group by drive order by n desc
                """,
                model_params,
            )
            drives = [{"value": r["drive"], "count": int(r["n"])} for r in cur.fetchall()]

            cur.execute(
                f"""
                select condition, count(*) as n from listing {model_clause}
                  and condition is not null and condition <> ''
                group by condition order by n desc
                """,
                model_params,
            )
            conditions = [
                {"value": r["condition"], "count": int(r["n"])} for r in cur.fetchall()
            ]

            cur.execute(
                f"""
                select color, count(*) as n from listing {model_clause}
                  and color is not null and color <> ''
                group by color order by n desc limit 40
                """,
                model_params,
            )
            colors = [{"value": r["color"], "count": int(r["n"])} for r in cur.fetchall()]

            cur.execute(
                f"select min(year_min) as y0, max(year_max) as y1 from model_option {clause}",
                params,
            )
            years = cur.fetchone()

            cur.execute(
                f"""
                select min(price_p10) as p10, max(price_p90) as p90 from model_option {clause}
                """,
                params,
            )
            prices = cur.fetchone()

            cur.execute(
                f"select sum(listings) as n, count(*) as combos from model_option {clause}",
                params,
            )
            totals = cur.fetchone()

        return {
            "gearboxes": gearboxes,
            "fuels": fuels,
            "bodies": bodies,
            "drives": drives,
            "conditions": conditions,
            "colors": colors,
            "years": {"min": years["y0"], "max": years["y1"]},
            "price": {"p10": prices["p10"], "p90": prices["p90"]},
            "listings": int(totals["n"] or 0),
            "combos": int(totals["combos"] or 0),
        }

    # -- подписки ----------------------------------------------------------
    def subscriptions(self, user_id: int) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select id, name, criteria, active, created_at
                from subscription where user_id = %s order by id desc
                """,
                (user_id,),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "criteria": r["criteria"],
                "active": r["active"],
                "created_at": _iso(r["created_at"]),
            }
            for r in rows
        ]

    def create_subscription(self, user_id: int, name: str, criteria: dict[str, Any]) -> dict:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into subscription (user_id, name, criteria)
                values (%s, %s, %s::jsonb)
                returning id, name, criteria, active, created_at
                """,
                (user_id, name, json.dumps(criteria)),
            )
            row = cur.fetchone()
        conn.commit()
        return {
            "id": row["id"],
            "name": row["name"],
            "criteria": row["criteria"],
            "active": row["active"],
            "created_at": _iso(row["created_at"]),
        }

    def update_subscription(
        self, user_id: int, sub_id: int, **fields: Any
    ) -> dict[str, Any] | None:
        sets, params = [], {"user_id": user_id, "id": sub_id}
        if "name" in fields and fields["name"]:
            sets.append("name = %(name)s")
            params["name"] = fields["name"]
        if "active" in fields and fields["active"] is not None:
            sets.append("active = %(active)s")
            params["active"] = bool(fields["active"])
        if "criteria" in fields and fields["criteria"]:
            sets.append("criteria = %(criteria)s::jsonb")
            params["criteria"] = json.dumps(fields["criteria"])
        if not sets:
            return None
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"update subscription set {', '.join(sets)} "
                "where id = %(id)s and user_id = %(user_id)s returning id",
                params,
            )
            row = cur.fetchone()
        conn.commit()
        if not row:
            return None
        return next(
            (s for s in self.subscriptions(user_id) if s["id"] == sub_id), None
        )

    def delete_subscription(self, user_id: int, sub_id: int) -> bool:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "delete from subscription where id = %s and user_id = %s",
                (sub_id, user_id),
            )
            deleted = cur.rowcount
        conn.commit()
        return bool(deleted)

    # -- избранное ---------------------------------------------------------
    def favorites(self, user_id: int) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select {FIELDS}, s.code as source_code, null::float8 as distance_km
                from favorite f
                join listing l on l.id = f.listing_id
                join source s on s.id = l.source_id
                where f.user_id = %s
                order by f.created_at desc
                """,
                (user_id,),
            )
            rows = cur.fetchall()
        items = [_item(row) for row in rows]
        if rows:
            try:
                analyses = self._market_analyses(rows)
            except Exception:
                analyses = {}
            for item in items:
                analysis = analyses.get(item["id"])
                if analysis:
                    item["price_analysis"] = analysis
        return items

    def add_favorite(self, user_id: int, listing_id: int) -> bool:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into favorite (user_id, listing_id) values (%s, %s) "
                "on conflict do nothing",
                (user_id, listing_id),
            )
            added = cur.rowcount
        conn.commit()
        return bool(added)

    def remove_favorite(self, user_id: int, listing_id: int) -> bool:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "delete from favorite where user_id = %s and listing_id = %s",
                (user_id, listing_id),
            )
            deleted = cur.rowcount
        conn.commit()
        return bool(deleted)
