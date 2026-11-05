"""Чтение данных для дашборда из Postgres (Supabase).

Дашборд работает поверх канонической схемы: `listing` + `source` + `listing_event`.
Файловое хранилище остаётся офлайн-режимом (`--file`).
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Any

DISTANCE_SQL = """
6371 * 2 * asin(least(1.0, sqrt(
    power(sin(radians(lat - %(lat)s) / 2), 2) +
    cos(radians(%(lat)s)) * cos(radians(lat)) *
    power(sin(radians(lon - %(lon)s) / 2), 2)
)))
"""

FIELDS = """
    external_id, url, title, price, currency, make, model, year, mileage_km,
    fuel, gearbox, body, power_hp, engine_cm3, color, vin, city, region,
    lat, lon, seller_type, seller_name, thumb_url, photos, photos_count,
    published_at, first_seen_at, last_seen_at, updated_at, status
"""


def _num(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)


def _item(row: dict[str, Any]) -> dict[str, Any]:
    published = row.get("published_at")
    return {
        "id": row["external_id"],
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
        "has_detail": (row.get("photos_count") or 0) > 0,
        "published_at": published.isoformat() if isinstance(published, datetime) else published,
        "distance_km": round(row["distance_km"], 1)
        if row.get("distance_km") is not None
        else None,
    }


class DatabaseRepo:
    def __init__(self, url: str) -> None:
        from psycopg_pool import ConnectionPool

        if "ljkugtpeboomboobodom" in url.lower():
            raise RuntimeError("это складская эко-система — дашборд сюда не подключаем")
        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=4,
            open=True,
            kwargs={"connect_timeout": 10, "row_factory": _dict_row()},
        )

    def close(self) -> None:
        self.pool.close()

    # -- список ------------------------------------------------------------
    def recent(
        self,
        limit: int = 8,
        *,
        lat: float | None = None,
        lon: float | None = None,
        radius_km: float | None = None,
    ) -> list[dict[str, Any]]:
        conds = ["status = 'active'"]
        params: dict[str, Any] = {"limit": limit, "radius": radius_km}
        distance = "null::float8 as distance_km"

        if lat is not None and lon is not None:
            params.update(lat=lat, lon=lon)
            distance = f"({DISTANCE_SQL}) as distance_km"
            if radius_km:
                # bbox: отсекаем по индексу (lat, lon) до точного расчёта
                dlat = radius_km / 111.0
                dlon = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.05))
                params.update(
                    lat_min=lat - dlat,
                    lat_max=lat + dlat,
                    lon_min=lon - dlon,
                    lon_max=lon + dlon,
                )
                conds.append(
                    "lat between %(lat_min)s and %(lat_max)s "
                    "and lon between %(lon_min)s and %(lon_max)s"
                )

        sql = f"""
            with base as (
                select {FIELDS},
                       {distance}
                from listing
                where {' and '.join(conds)}
            )
            select * from base
            where %(radius)s::float8 is null or distance_km <= %(radius)s::float8
            order by distance_km nulls last, published_at desc nulls last
            limit %(limit)s
        """
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [_item(row) for row in rows]

    # -- карточка ----------------------------------------------------------
    def get(self, external_id: str, code: str = "otomoto") -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select {FIELDS}, s.code as source_code
                from listing l
                join source s on s.id = l.source_id
                where l.external_id = %s and s.code = %s
                """,
                (external_id, code),
            )
            row = cur.fetchone()
            if not row:
                return None
            cur.execute(
                """
                select kind, old_price, new_price, observed_at
                from listing_event where listing_id = (
                    select id from listing where external_id = %s
                ) order by observed_at desc limit 10
                """,
                (external_id,),
            )
            events = [
                {
                    "kind": e["kind"],
                    "old_price": _num(e["old_price"]),
                    "new_price": _num(e["new_price"]),
                    "observed_at": e["observed_at"].isoformat(),
                }
                for e in cur.fetchall()
            ]
        return self._card(row, events)

    def _card(self, row: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
        photos = [p for p in (row.get("photos") or []) if p]
        if not photos and row.get("thumb_url"):
            photos = [row["thumb_url"]]
        published = row.get("published_at")
        updated = row.get("updated_at")
        return {
            "id": row["external_id"],
            "url": row["url"],
            "title": row["title"],
            "price": _num(row.get("price")),
            "currency": (row.get("currency") or "PLN").strip(),
            "photos": photos[:8],
            "description": "",
            "details": {},
            "seller": {
                "type": "dealer"
                if row.get("seller_type") == "dealer"
                else ("private" if row.get("seller_type") == "private" else None),
                "name": row.get("seller_name") or "",
            },
            "city": row.get("city") or "",
            "region": row.get("region") or "",
            "created_at": published.isoformat() if isinstance(published, datetime) else published,
            "updated_at": updated.isoformat() if isinstance(updated, datetime) else updated,
            "has_detail": (row.get("photos_count") or 0) > 0,
            "fetched_at": updated.isoformat() if isinstance(updated, datetime) else updated,
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
            "country_origin": "",
            "address": "",
            "lat": row.get("lat"),
            "lon": row.get("lon"),
            "geo_source": "advert" if photos and row.get("lat") is not None else "city",
            "events": events,
            "source": row.get("source_code", "otomoto"),
        }

    # -- счётчики ----------------------------------------------------------
    def stats(self) -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select count(*) as total,
                       count(*) filter (where status = 'active') as active,
                       count(*) filter (where photos_count > 0) as with_photos
                from listing
                """
            )
            counts = cur.fetchone()
            cur.execute("select count(*) as events from listing_event")
            events = cur.fetchone()["events"]
            cur.execute("select pg_size_pretty(pg_total_relation_size('listing')) as size")
            size = cur.fetchone()["size"]
        return {
            "mode": "db",
            "listings": counts["total"],
            "active": counts["active"],
            "with_photos": counts["with_photos"],
            "events": events,
            "size": size,
            "detail_files": counts["total"],
            "detail_bytes": 0,
        }


def _dict_row():  # noqa: ANN202
    from psycopg.rows import dict_row

    return dict_row


def now_iso() -> str:
    return datetime.now(UTC).isoformat()
