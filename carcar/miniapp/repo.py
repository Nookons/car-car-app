"""Данные для Mini App: поиск объявлений, пользователи, подписки, избранное."""

from __future__ import annotations

import json
import math
from datetime import datetime
from typing import Any

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
    l.description, l.thumb_url, l.photos, l.photos_count, l.published_at, l.first_seen_at,
    l.last_seen_at, l.status
"""


def _num(value: Any) -> int | None:
    return None if value is None else int(value)


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else value


def _item(row: dict[str, Any]) -> dict[str, Any]:
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
        "thumbnail": row.get("thumb_url"),
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
    }


class MiniAppRepo:
    def __init__(self, url: str) -> None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        if "ljkugtpeboomboobodom" in url.lower():
            raise RuntimeError("это складская эко-система — Mini App сюда не подключаем")
        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=6,
            open=True,
            kwargs={"connect_timeout": 10, "row_factory": dict_row},
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
        mileage_max: int | None = None,
        fuel: str | None = None,
        gearbox: str | None = None,
        source: str | None = None,
        lat: float | None = None,
        lon: float | None = None,
        radius_km: float | None = None,
        sort: str = "new",
    ) -> tuple[list[dict[str, Any]], int]:
        limit = max(1, min(limit, 50))
        offset = max(0, offset)
        conds = ["l.status = 'active'"]
        params: dict[str, Any] = {"limit": limit, "offset": offset, "radius": radius_km}

        if q:
            conds.append("(l.title ILIKE %(q)s OR l.make ILIKE %(q)s OR l.model ILIKE %(q)s)")
            params["q"] = f"%{q}%"
        if make:
            conds.append("l.make ILIKE %(make)s")
            params["make"] = f"%{make}%"
        if model:
            conds.append("l.model ILIKE %(model)s")
            params["model"] = f"%{model}%"
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
        if mileage_max is not None:
            conds.append("l.mileage_km <= %(mileage_max)s")
            params["mileage_max"] = mileage_max
        if fuel:
            conds.append("l.fuel = %(fuel)s")
            params["fuel"] = fuel
        if gearbox:
            conds.append("l.gearbox = %(gearbox)s")
            params["gearbox"] = gearbox
        if source:
            conds.append("s.code = %(source)s")
            params["source"] = source

        distance = "null::float8"
        if lat is not None and lon is not None:
            params.update(lat=lat, lon=lon)
            distance = f"({DISTANCE_SQL})"
            if radius_km:
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
            "new": "published_at desc nulls last",
            "price_asc": "price asc nulls last",
            "price_desc": "price desc nulls last",
            "distance": "distance_km nulls last",
        }.get(sort, "published_at desc nulls last")

        base = f"""
            select {FIELDS}, s.code as source_code, {distance} as distance_km
            from listing l join source s on s.id = l.source_id
            where {' and '.join(conds)}
        """
        sql = f"""
            with base as ({base})
            select *, count(*) over() as total
            from base
            where %(radius)s::float8 is null or distance_km <= %(radius)s::float8
            order by {order}
            limit %(limit)s offset %(offset)s
        """
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        total = int(rows[0]["total"]) if rows else 0
        return [_item(row) for row in rows], total

    def set_description(self, listing_id: int, text: str) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update listing set description = %s where id = %s and description is null",
                (text[:2000], listing_id),
            )
        conn.commit()

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

            analysis = None
            if row.get("price") and row.get("make") and row.get("model"):
                year = row.get("year")
                mileage = row.get("mileage_km")
                cur.execute(
                    """
                    select percentile_cont(0.5) within group (order by price) as median,
                           count(*) as sample
                    from listing
                    where status = 'active' and price is not null
                      and make = %s and model = %s
                      and (%s::int is null or year between %s::int - 2 and %s::int + 2)
                      and (%s::int is null or mileage_km between %s::int * 0.7 and %s::int * 1.3)
                    """,
                    (
                        row["make"], row["model"],
                        year, year, year,
                        mileage, mileage, mileage,
                    ),
                )
                stat = cur.fetchone()
                median = _num(stat["median"]) if stat and stat["median"] else None
                sample = int(stat["sample"]) if stat else 0
                if median and sample >= 5:
                    diff = round((row["price"] - median) / median * 100)
                    analysis = {
                        "median": median,
                        "sample": sample,
                        "diff_pct": diff,
                        "verdict": "below" if diff <= -5 else ("above" if diff >= 5 else "fair"),
                    }
        if not row.get("description") and row.get("url"):
            # Описание не хранилось раньше — добираем лениво, при первом открытии.
            try:
                from ..client import Client
                from ..config import Settings
                from ..parse import parse_offer

                client = Client(Settings())
                offer = parse_offer(client.get(row["url"]), row["url"])
                text = (offer.description or "").strip()[:2000]
                if text:
                    self.set_description(listing_id, text)
                    row["description"] = text
            except Exception:
                pass

        return _card(row, events, analysis)

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
        return [_item(r) for r in rows]

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
