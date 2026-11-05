"""Чтение данных для дашборда из Postgres (Supabase).

Мультиплатформенность: все запросы идут через `source`, поэтому дашборд
одинаково показывает otomoto, OLX и любую следующую площадку.
"""

from __future__ import annotations

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
    l.thumb_url, l.photos, l.photos_count, l.published_at, l.first_seen_at,
    l.last_seen_at, l.updated_at, l.status
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
        "city": row.get("city"),
        "region": row.get("region"),
        "lat": row.get("lat"),
        "lon": row.get("lon"),
        "seller_type": row.get("seller_type"),
        "thumbnail": row.get("thumb_url"),
        "photos_count": row.get("photos_count") or 0,
        "has_detail": (row.get("photos_count") or 0) > 0,
        "published_at": _iso(row.get("published_at")),
        "distance_km": round(row["distance_km"], 1)
        if row.get("distance_km") is not None
        else None,
    }


class DatabaseRepo:
    def __init__(self, url: str) -> None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        if "ljkugtpeboomboobodom" in url.lower():
            raise RuntimeError("это складская эко-система — дашборд сюда не подключаем")
        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=4,
            open=True,
            kwargs={"connect_timeout": 10, "row_factory": dict_row},
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
        source: str | None = None,
    ) -> list[dict[str, Any]]:
        conds = ["l.status = 'active'"]
        params: dict[str, Any] = {"limit": limit, "radius": radius_km}
        distance = "null::float8"

        if source:
            conds.append("s.code = %(source)s")
            params["source"] = source

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

        sql = f"""
            with base as (
                select {FIELDS}, s.code as source_code, {distance} as distance_km
                from listing l
                join source s on s.id = l.source_id
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
    def get(self, listing_id: int | str) -> dict[str, Any] | None:
        try:
            key = int(listing_id)
        except (TypeError, ValueError):
            return None
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select {FIELDS}, s.code as source_code
                from listing l join source s on s.id = l.source_id
                where l.id = %s
                """,
                (key,),
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
                (key,),
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
        return self._card(row, events)

    def _card(self, row: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
        photos = [p for p in (row.get("photos") or []) if p] or (
            [row["thumb_url"]] if row.get("thumb_url") else []
        )
        has_photos = (row.get("photos_count") or 0) > 0
        return {
            "id": row["id"],
            "external_id": row["external_id"],
            "source": row.get("source_code"),
            "url": row["url"],
            "title": row["title"],
            "price": _num(row.get("price")),
            "currency": (row.get("currency") or "PLN").strip(),
            "photos": photos[:60],
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
            "created_at": _iso(row.get("published_at")),
            "updated_at": _iso(row.get("updated_at")),
            "has_detail": has_photos,
            "fetched_at": _iso(row.get("updated_at")),
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
            "geo_source": "advert" if has_photos else "city",
            "events": events,
            "first_seen_at": _iso(row.get("first_seen_at")),
            "last_seen_at": _iso(row.get("last_seen_at")),
        }

    # -- коллекторы --------------------------------------------------------
    def collectors(self) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select s.code as source, c.status, c.heartbeat_at, c.interval_seconds,
                       c.round, c.last_poll_at, c.last_error, c.stats, c.paused,
                       c.paused_reason, c.paused_at
                from source s left join collector c on c.source_id = s.id
                order by s.code
                """
            )
            return [dict(r) for r in cur.fetchall()]

    def set_paused(self, source: str, paused: bool, reason: str | None, by: str) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into collector (source_id, paused, paused_reason, paused_at, updated_at)
                select id, %s, %s, case when %s then now() end, now()
                from source where code = %s
                on conflict (source_id) do update set
                    paused = excluded.paused,
                    paused_reason = excluded.paused_reason,
                    paused_at = case when excluded.paused then now() else null end,
                    updated_at = now()
                """,
                (paused, reason, paused, source),
            )
        conn.commit()

    # -- метрики -----------------------------------------------------------
    def metrics(self, days: int = 30, months: int = 12) -> dict[str, Any]:
        days = max(1, min(days, 365))
        months = max(1, min(months, 36))
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select s.code as source,
                       count(l.id) filter (where l.status = 'active') as active,
                       count(l.id) as total,
                       count(l.id) filter (
                           where l.first_seen_at >= date_trunc('day', now())
                       ) as today,
                       count(l.id) filter (
                           where l.first_seen_at >= now() - interval '7 days'
                       ) as week,
                       count(l.id) filter (
                           where l.first_seen_at >= now() - interval '30 days'
                       ) as month,
                       percentile_cont(0.5) within group (order by l.price)
                           filter (where l.status = 'active') as median_price,
                       max(l.last_seen_at) as last_seen
                from source s
                left join listing l on l.source_id = s.id
                group by s.code
                order by s.code
                """
            )
            by_source = [
                {
                    "source": r["source"],
                    "active": int(r["active"] or 0),
                    "total": int(r["total"] or 0),
                    "today": int(r["today"] or 0),
                    "week": int(r["week"] or 0),
                    "month": int(r["month"] or 0),
                    "median_price": _num(r["median_price"]),
                    "last_seen": _iso(r["last_seen"]),
                }
                for r in cur.fetchall()
            ]

            cur.execute(
                """
                select to_char(d::date, 'YYYY-MM-DD') as day,
                       s.code as source,
                       count(l.id)::int as count
                from generate_series(
                        current_date - (%(days)s - 1) * interval '1 day',
                        current_date, interval '1 day') d
                cross join source s
                left join listing l
                       on l.source_id = s.id
                      and l.first_seen_at >= d
                      and l.first_seen_at < d + interval '1 day'
                group by 1, 2
                order by 1, 2
                """,
                {"days": days},
            )
            daily = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                select to_char(d, 'YYYY-MM') as month,
                       s.code as source,
                       count(l.id)::int as count
                from generate_series(
                        date_trunc('month', current_date)
                            - (%(months)s - 1) * interval '1 month',
                        date_trunc('month', current_date), interval '1 month') d
                cross join source s
                left join listing l
                       on l.source_id = s.id
                      and l.first_seen_at >= d
                      and l.first_seen_at < d + interval '1 month'
                group by 1, 2
                order by 1, 2
                """,
                {"months": months},
            )
            monthly = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                select to_char(r.started_at::date, 'YYYY-MM-DD') as day,
                       s.code as source,
                       sum(r.pages)::int as pages,
                       sum(r.inserted)::int as inserted,
                       sum(r.errors)::int as errors
                from crawl_run r
                join source s on s.id = r.source_id
                where r.started_at >= current_date - (%(days)s - 1) * interval '1 day'
                group by 1, 2
                order by 1, 2
                """,
                {"days": days},
            )
            runs = [dict(r) for r in cur.fetchall()]

        totals = {
            "today": sum(x["today"] for x in by_source),
            "week": sum(x["week"] for x in by_source),
            "month": sum(x["month"] for x in by_source),
            "active": sum(x["active"] for x in by_source),
            "sources": sum(1 for item in by_source if item["total"] > 0),
        }
        return {
            "by_source": by_source,
            "daily": daily,
            "monthly": monthly,
            "runs": runs,
            "totals": totals,
            "days": days,
            "months": months,
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
