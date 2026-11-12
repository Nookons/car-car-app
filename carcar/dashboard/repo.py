"""Чтение данных для дашборда из Postgres (Supabase).

Мультиплатформенность: все запросы идут через `source`, поэтому дашборд
одинаково показывает otomoto, OLX и любую следующую площадку.
"""

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

    def service_notices(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        active = "and (c.stats #>> '{service_notice,starts_at}')::timestamptz <= now() " \
                 "and (c.stats #>> '{service_notice,ends_at}')::timestamptz > now()" \
                 if active_only else ""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select s.code as source, c.stats->'service_notice' as notice,
                       (c.stats #>> '{{service_notice,starts_at}}')::timestamptz <= now()
                           and (c.stats #>> '{{service_notice,ends_at}}')::timestamptz > now() as active
                from public.source s join public.collector c on c.source_id = s.id
                where c.stats ? 'service_notice' {active}
                order by s.code
                """
            )
            rows = cur.fetchall()
        return [
            {
                "source": row["source"],
                **row["notice"],
                "active": bool(row["active"]),
            }
            for row in rows
            if isinstance(row["notice"], dict)
        ]

    def set_service_notice(
        self, source: str, mode: str | None, reason: str | None,
        starts_at: datetime | None, ends_at: datetime | None, by: str = "dashboard",
    ) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            if mode is None:
                cur.execute("select id from public.source where code = %s", (source,))
                source_row = cur.fetchone()
                if not source_row:
                    raise ValueError("неизвестная площадка")
                cur.execute(
                    "update public.collector set stats = coalesce(stats, '{}'::jsonb) - 'service_notice', "
                    "updated_at = now() where source_id = %s", (source_row["id"],)
                )
            else:
                notice = json.dumps({
                    "mode": mode,
                    "reason": reason,
                    "starts_at": starts_at.isoformat(),
                    "ends_at": ends_at.isoformat(),
                    "updated_by": by,
                })
                cur.execute(
                    """
                    insert into public.collector (source_id, stats, updated_at)
                    select id, jsonb_build_object('service_notice', %s::jsonb), now()
                    from public.source where code = %s
                    on conflict (source_id) do update set
                        stats = coalesce(collector.stats, '{}'::jsonb) || excluded.stats,
                        updated_at = now()
                    """,
                    (notice, source),
                )
                if cur.rowcount == 0:
                    raise ValueError("неизвестная площадка")
        conn.commit()

    def app_announcement(self) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute("select message, starts_at, ends_at, updated_at from public.app_announcement where id = 1")
            row = cur.fetchone()
        if not row:
            return None
        return {**row, **{key: _iso(row[key]) for key in ("starts_at", "ends_at", "updated_at")}}

    def set_app_announcement(self, message: str, starts_at: datetime, ends_at: datetime) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """insert into public.app_announcement (id, message, starts_at, ends_at, updated_at)
                   values (1, %s, %s, %s, now()) on conflict (id) do update set
                     message = excluded.message, starts_at = excluded.starts_at,
                     ends_at = excluded.ends_at, updated_at = now()""",
                (message, starts_at, ends_at),
            )
        conn.commit()

    def clear_app_announcement(self) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute("delete from public.app_announcement where id = 1")
        conn.commit()

    def search_listings(
        self, *, status: str = "all", source: str | None = None,
        query: str | None = None, limit: int = 50, offset: int = 0,
    ) -> dict[str, Any]:
        conds: list[str] = []
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if status in {"active", "removed"}:
            conds.append("l.status = %(status)s")
            params["status"] = status
        if source:
            conds.append("s.code = %(source)s")
            params["source"] = source
        if query:
            conds.append("(l.title ilike %(query)s or l.make ilike %(query)s or l.model ilike %(query)s or l.city ilike %(query)s or l.external_id ilike %(query)s)")
            params["query"] = f"%{query.strip()}%"
        where = " where " + " and ".join(conds) if conds else ""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(f"select count(*)::int total from listing l join source s on s.id=l.source_id{where}", params)
            total = int(cur.fetchone()["total"])
            cur.execute(
                f"""select l.id, l.external_id, s.code as source, l.url, l.title, l.price,
                           l.currency, l.make, l.model, l.year, l.mileage_km, l.city,
                           l.thumb_url, l.photos_count, l.status, l.published_at, l.last_seen_at
                    from listing l join source s on s.id=l.source_id{where}
                    order by l.last_seen_at desc nulls last, l.id desc limit %(limit)s offset %(offset)s""",
                params,
            )
            items = [{**row, "published_at": _iso(row["published_at"]), "last_seen_at": _iso(row["last_seen_at"])} for row in cur.fetchall()]
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    def update_listing_admin(self, listing_id: int, fields: dict[str, Any]) -> bool:
        status = fields.get("status")
        if status not in {"active", "removed"}:
            return False
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute("select source_id, external_id from public.listing where id = %s for update", (listing_id,))
            row = cur.fetchone()
            if not row:
                return False
            key = (row["source_id"], row["external_id"])
            if status == "removed":
                cur.execute("""insert into public.listing_moderation (source_id, external_id, action)
                               values (%s, %s, 'hidden') on conflict (source_id, external_id)
                               do update set action='hidden', updated_at=now()""", key)
            else:
                cur.execute("delete from public.listing_moderation where source_id=%s and external_id=%s", key)
            cur.execute("update public.listing set status=%s, updated_at=now() where id=%s", (status, listing_id))
        conn.commit()
        return True

    def delete_listing_admin(self, listing_id: int) -> bool:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute("select source_id, external_id from public.listing where id=%s for update", (listing_id,))
            row = cur.fetchone()
            if not row:
                return False
            cur.execute("""insert into public.listing_moderation (source_id, external_id, action)
                           values (%s, %s, 'deleted') on conflict (source_id, external_id)
                           do update set action='deleted', updated_at=now()""", (row["source_id"], row["external_id"]))
            cur.execute("delete from public.listing where id=%s", (listing_id,))
        conn.commit()
        return True

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
            "status": row.get("status"),
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
    def runs(self, limit: int = 5) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select r.started_at, r.finished_at, r.pages, r.items, r.inserted,
                       r.errors, r.notes, s.code as source
                from crawl_run r join source s on s.id = r.source_id
                order by r.started_at desc limit %s
                """,
                (limit,),
            )
            return [
                {
                    "started_at": _iso(r["started_at"]),
                    "finished_at": _iso(r["finished_at"]),
                    "source": r["source"],
                    "pages": r["pages"],
                    "items": r["items"],
                    "new": r["inserted"],
                    "errors": r["errors"],
                    "notes": r["notes"],
                }
                for r in cur.fetchall()
            ]

    def polls(self, limit: int = 60) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select started_at, inserted, errors from crawl_run
                where notes = 'watch' and started_at is not null and finished_at is not null
                order by started_at desc limit %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "ts": _iso(r["started_at"]),
                "new": r["inserted"],
                "errors": r["errors"],
            }
            for r in reversed(rows)
        ]

    def logs(self, limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(limit, 200))
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select * from (
                    select r.started_at as at, s.code as source, 'error' as level,
                           'Прогон завершился с ошибками: ' || r.errors::text as message,
                           left(coalesce(r.notes, 'crawl_run'), 1000) as details
                    from crawl_run r join source s on s.id = r.source_id
                    where r.errors > 0
                    union all
                    select j.created_at, coalesce(s.code, 'unknown'), 'reject',
                           'Объявление отклонено',
                           left(coalesce(j.external_id || ': ', '') || j.reason, 1000)
                    from ingest_reject j left join source s on s.id = j.source_id
                    union all
                    select c.heartbeat_at, s.code, 'error', 'Последняя ошибка сборщика',
                           left(c.last_error, 1000)
                    from collector c join source s on s.id = c.source_id
                    where c.last_error is not null and c.heartbeat_at is not null
                ) events
                order by at desc nulls last
                limit %s
                """,
                (limit,),
            )
            return [
                {**row, "at": _iso(row["at"])}
                for row in cur.fetchall()
            ]

    def sweep_state(self, source: str = "otomoto") -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select w.next_page, w.total_pages, w.inserted, w.updated
                from sweep_state w join source s on s.id = w.source_id
                where s.code = %s
                """,
                (source,),
            )
            row = cur.fetchone()
        return dict(row) if row else {}

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

    # -- поддержка пользователей -----------------------------------------
    def user_activity_metrics(
        self, days: int, limit: int, offset: int, query: str | None = None
    ) -> dict[str, Any]:
        days = max(1, min(days, 90))
        limit = max(1, min(limit, 200))
        offset = max(0, min(offset, 100_000))
        query = (query or "").strip()[:100]
        user_filter = ""
        user_args: list[Any] = []
        if query:
            pattern = f"%{query}%"
            predicates = [
                "u.username ilike %s", "u.first_name ilike %s",
                "u.last_name ilike %s", "u.email ilike %s",
            ]
            user_args = [pattern] * len(predicates)
            if query.isdigit():
                predicates.extend(["u.id::text = %s", "u.tg_id::text = %s"])
                user_args.extend([query, query])
            user_filter = "where (" + " or ".join(predicates) + ")"
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """select count(*)::int registered_users,
                    count(*) filter (where last_seen_at >= now() - interval '1 day')::int dau,
                    count(*) filter (where last_seen_at >= now() - interval '7 days')::int wau,
                    count(*) filter (where last_seen_at >= now() - interval '30 days')::int mau
                    from app_user"""
            )
            totals = cur.fetchone()
            cur.execute(
                """select day, sum(sessions)::int sessions, sum(searches)::int searches,
                          sum(listing_views)::int listing_views,
                          sum(favorites_added)::int favorites_added,
                          sum(subscriptions_created)::int subscriptions_created,
                          count(distinct user_id)::int active_users
                   from user_activity_daily where day >= current_date - %s
                   group by day order by day""",
                (days - 1,),
            )
            daily = cur.fetchall()
            cur.execute(
                f"""select u.id, u.tg_id, u.username, u.email, u.phone,
                          u.first_name, u.last_name, u.created_at, u.last_seen_at,
                          (u.password_hash is not null) as has_password,
                          coalesce(sum(a.sessions), 0)::int sessions,
                          coalesce(sum(a.searches), 0)::int searches,
                          coalesce(sum(a.listing_views), 0)::int listing_views,
                          coalesce(sum(a.favorites_added), 0)::int favorites_added,
                          coalesce(sum(a.subscriptions_created), 0)::int subscriptions_created
                   from app_user u left join user_activity_daily a
                     on a.user_id = u.id and a.day >= current_date - %s
                   {user_filter}
                   group by u.id order by u.last_seen_at desc nulls last
                   limit %s offset %s""",
                (days - 1, *user_args, limit, offset),
            )
            users = cur.fetchall()
            cur.execute(f"select count(*)::int as total from app_user u {user_filter}", user_args)
            total_users = int(cur.fetchone()["total"])
            cur.execute(
                """select l.id, l.title, count(*)::int views
                   from listing_view v join listing l on l.id = v.listing_id
                   where v.day >= current_date - %s
                   group by l.id, l.title order by views desc limit 20""",
                (days - 1,),
            )
            top_listings = cur.fetchall()
        return {
            "totals": totals, "daily": daily, "users": users,
            "total_users": total_users, "top_listings": top_listings,
            "limit": limit, "offset": offset,
        }

    def user_activity_detail(
        self, user_id: int, days: int = 30, search_limit: int = 100
    ) -> dict[str, Any] | None:
        days = max(1, min(days, 90))
        search_limit = max(1, min(search_limit, 200))
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """select id, tg_id, username, email, phone, first_name, last_name,
                          created_at, last_seen_at, (password_hash is not null) has_password,
                          (email is not null or phone_verified_at is not null) can_set_password
                   from app_user where id = %s""", (user_id,)
            )
            user = cur.fetchone()
            if not user:
                return None
            cur.execute(
                """select coalesce(sum(sessions), 0)::int sessions,
                          coalesce(sum(searches), 0)::int searches,
                          coalesce(sum(listing_views), 0)::int listing_views,
                          coalesce(sum(favorites_added), 0)::int favorites_added,
                          coalesce(sum(subscriptions_created), 0)::int subscriptions_created,
                          count(*)::int active_days
                   from user_activity_daily
                   where user_id = %s and day >= current_date - %s""",
                (user_id, days - 1),
            )
            totals = cur.fetchone()
            cur.execute(
                """select day, sessions, searches, listing_views, favorites_added,
                          subscriptions_created, last_active_at
                   from user_activity_daily where user_id = %s
                     and day >= current_date - %s order by day desc""",
                (user_id, days - 1),
            )
            daily = [
                {**row, "day": row["day"].isoformat(), "last_active_at": _iso(row["last_active_at"])}
                for row in cur.fetchall()
            ]
            cur.execute(
                """select created_at, meta from funnel_event
                   where user_id = %s and kind = 'search'
                     and created_at >= now() - make_interval(days => %s)
                   order by created_at desc limit %s""",
                (user_id, days, search_limit),
            )
            searches = [{"at": _iso(row["created_at"]), **(row["meta"] or {})} for row in cur.fetchall()]
        return {
            "user": {**user, "created_at": _iso(user["created_at"]), "last_seen_at": _iso(user["last_seen_at"])},
            "days": days, "totals": totals, "daily": daily, "searches": searches,
        }

    def user_web_sessions(self, user_id: int) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """select id, user_agent, created_at, last_seen_at, expires_at
                   from web_session where user_id = %s and revoked_at is null
                     and expires_at > now()
                   order by last_seen_at desc limit 100""",
                (user_id,),
            )
            return [{**row, **{key: _iso(row[key]) for key in ("created_at", "last_seen_at", "expires_at")}}
                    for row in cur.fetchall()]

    def revoke_user_web_session(self, user_id: int, session_id: int | None = None) -> int:
        with self.pool.connection() as conn, conn.cursor() as cur:
            if session_id is None:
                cur.execute(
                    "update app_user set auth_version = auth_version + 1 where id = %s",
                    (user_id,),
                )
                if cur.rowcount == 0:
                    return 0
                cur.execute(
                    """update web_session set revoked_at = now()
                       where user_id = %s and revoked_at is null and expires_at > now()""",
                    (user_id,),
                )
            else:
                cur.execute(
                    """update web_session set revoked_at = now()
                       where user_id = %s and id = %s and revoked_at is null""",
                    (user_id, session_id),
                )
            return cur.rowcount

    def set_user_password(self, user_id: int, password_hash: str) -> bool:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """update app_user set password_hash = %s,
                          auth_version = auth_version + 1
                   where id = %s and (email is not null or phone_verified_at is not null)""",
                (password_hash, user_id),
            )
            updated = cur.rowcount
            if updated:
                cur.execute(
                    """update web_session set revoked_at = now()
                       where user_id = %s and revoked_at is null""", (user_id,)
                )
        return updated == 1

    def funnel_metrics(self, days: int = 30) -> dict[str, Any]:
        days = max(1, min(days, 365))
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """select kind, count(*)::int events,
                          count(distinct visitor_id)::int visitors,
                          count(distinct user_id)::int users
                   from funnel_event where created_at >= now() - make_interval(days => %s)
                   group by kind order by kind""", (days,)
            )
            by_kind = {row["kind"]: row for row in cur.fetchall()}
            cur.execute(
                """select created_at::date as "day", kind, count(*)::int events
                   from funnel_event where created_at >= now() - make_interval(days => %s)
                   group by 1, 2 order by 1, 2""", (days,)
            )
            daily = cur.fetchall()
            cur.execute(
                """select count(*)::int registered from app_user
                   where created_at >= now() - make_interval(days => %s)""", (days,)
            )
            registered = int(cur.fetchone()["registered"])
            cur.execute(
                """select count(distinct e.user_id)::int activated_7d
                   from funnel_event e join app_user u on u.id = e.user_id
                   where e.kind in ('saved_search', 'favorite_add')
                     and e.created_at >= u.created_at
                     and e.created_at <= u.created_at + interval '7 days'
                     and u.created_at >= now() - make_interval(days => %s)""", (days,)
            )
            activated = int(cur.fetchone()["activated_7d"])
        stages = []
        previous = None
        for kind in ("visit", "search", "saved_search", "alert_open"):
            row = by_kind.get(kind, {"events": 0, "visitors": 0, "users": 0})
            visitors = int(row["visitors"] or 0)
            stages.append({
                "kind": kind, "events": int(row["events"] or 0),
                "visitors": visitors, "users": int(row["users"] or 0),
                "conversion": round(visitors / previous, 4) if previous else None,
            })
            previous = visitors
        return {"days": days, "registered": registered, "activated_7d": activated,
                "stages": stages, "daily": daily}

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
                       coalesce(max(r.today), 0)::int as today,
                       coalesce(max(r.week), 0)::int as week,
                       coalesce(max(r.month), 0)::int as month,
                       percentile_cont(0.5) within group (order by l.price)
                           filter (where l.status = 'active') as median_price,
                       max(l.last_seen_at) as last_seen
                from source s
                left join listing l on l.source_id = s.id
                left join lateral (
                    select
                      sum(inserted) filter (where started_at >=
                        (date_trunc('day', now() at time zone 'Europe/Warsaw')
                          at time zone 'Europe/Warsaw'))::int as today,
                      sum(inserted) filter (where started_at >= now() - interval '7 days')::int as week,
                      sum(inserted) filter (where started_at >= now() - interval '30 days')::int as month
                    from crawl_run where source_id = s.id and finished_at is not null
                ) r on true
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
                select to_char(d, 'YYYY-MM-DD') as day,
                       s.code as source,
                       coalesce(sum(r.inserted), 0)::int as count
                from generate_series(
                        (date_trunc('day', now() at time zone 'Europe/Warsaw')
                          - (%(days)s - 1) * interval '1 day'),
                        date_trunc('day', now() at time zone 'Europe/Warsaw'), interval '1 day') d
                cross join source s
                left join crawl_run r
                       on r.source_id = s.id
                      and r.finished_at is not null
                      and r.started_at >= (d at time zone 'Europe/Warsaw')
                      and r.started_at < ((d + interval '1 day') at time zone 'Europe/Warsaw')
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
                       coalesce(sum(r.inserted), 0)::int as count
                from generate_series(
                        (date_trunc('month', now() at time zone 'Europe/Warsaw')
                            - (%(months)s - 1) * interval '1 month'),
                        date_trunc('month', now() at time zone 'Europe/Warsaw'), interval '1 month') d
                cross join source s
                left join crawl_run r
                       on r.source_id = s.id
                      and r.finished_at is not null
                      and r.started_at >= (d at time zone 'Europe/Warsaw')
                      and r.started_at < ((d + interval '1 month') at time zone 'Europe/Warsaw')
                group by 1, 2
                order by 1, 2
                """,
                {"months": months},
            )
            monthly = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                select to_char(r.started_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD') as day,
                       s.code as source,
                       sum(r.pages)::int as pages,
                       sum(r.inserted)::int as inserted,
                       sum(r.errors)::int as errors
                from crawl_run r
                join source s on s.id = r.source_id
                where r.started_at >=
                      ((date_trunc('day', now() at time zone 'Europe/Warsaw')
                        - (%(days)s - 1) * interval '1 day') at time zone 'Europe/Warsaw')
                  and r.finished_at is not null
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
