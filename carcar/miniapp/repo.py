"""Данные для Mini App: поиск объявлений, пользователи, подписки, избранное."""

from __future__ import annotations

import json
import math
import os
import re
import uuid
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
    l.thumb_url, l.photos[1:6] as photos, l.photos_count, l.published_at, l.first_seen_at,
    l.last_seen_at, l.status
"""

# Порядок «интересно → свежо»: score из единой формулы (см. listing_stat_score
# в schema.sql), поделённый на 1 + возраст_в_днях/21. Через три недели объявление
# стоит в выдаче вдвое дешевле, но не исчезает: вечный хит не вытесняет рынок.
SCORE_ORDER = (
    "coalesce(st.score, 0) / (1 + greatest("
    "extract(epoch from now() - coalesce(l.published_at, l.first_seen_at))"
    " / 86400.0, 0) / 21.0)"
)


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
        "distance_km": round(row["distance_km"], 1) if row.get("distance_km") is not None else None,
    }


def _price_history(
    row: dict[str, Any], events: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], int | None]:
    """Точки истории цены: стартовая, изменения из listing_event, текущая.

    Стартовой считаем old_price первого события — это цена до первого
    изменения. Если событий нет, истории нет: показывать нечего.
    """
    current = _num(row.get("price"))
    if not events:
        return [], current
    history: list[dict[str, Any]] = []
    initial = _num(events[0].get("old_price"))
    if initial is not None:
        history.append(
            {
                "price": initial,
                "at": _iso(row.get("first_seen_at")) or _iso(events[0].get("observed_at")),
                "kind": "initial",
            }
        )
    for event in events:
        new = _num(event.get("new_price"))
        if new is None:
            continue
        if history and history[-1]["price"] == new:
            continue
        history.append(
            {
                "price": new,
                "at": _iso(event.get("observed_at")),
                "kind": event.get("kind") or "price",
            }
        )
    if current is not None and (not history or history[-1]["price"] != current):
        history.append({"price": current, "at": _iso(row.get("last_seen_at")), "kind": "current"})
    if len(history) > 12:
        # Стартовая точка + последние изменения: длинную историю не раздуваем.
        history = [history[0], *history[-11:]]
    return history, initial if initial is not None else current


def _card(
    row: dict[str, Any],
    events: list[dict[str, Any]],
    analysis: dict[str, Any] | None = None,
    price_history: list[dict[str, Any]] | None = None,
    initial_price: int | None = None,
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
        "price_history": price_history or [],
        "initial_price": initial_price if initial_price is not None else _num(row.get("price")),
        "status": row.get("status") or "active",
        "first_seen_at": _iso(row.get("first_seen_at")),
        "last_seen_at": _iso(row.get("last_seen_at")),
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

# Площадка иногда пишет «Inny» вместо модели: такие строки нельзя сравнивать
# по модели — для похожих остаются марка, кузов и цена.
GENERIC_MODELS = {"inny", "inne", "other", "unknown", "другое", "інше"}

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


# Поля пользователя, которые отдаются наружу. `password_hash` сюда не входит
# намеренно: хеш читается только отдельным запросом при входе.
USER_KEYS = (
    "id",
    "tg_id",
    "username",
    "first_name",
    "last_name",
    "email",
    "phone",
    "email_verified",
    "phone_verified",
    "has_password",
    "lang",
    "notify_new",
    "notify_price",
    "digest",
    "created_at",
)

USER_FIELDS = """
    id, tg_id, username, first_name, last_name, email, phone,
    (email_verified_at is not null) as email_verified,
    (phone_verified_at is not null) as phone_verified,
    (password_hash is not null) as has_password,
    lang, notify_new, notify_price, digest, created_at
"""

SESSION_USER_FIELDS = """
    u.id, u.tg_id, u.username, u.first_name, u.last_name, u.email, u.phone,
    (u.email_verified_at is not null) as email_verified,
    (u.phone_verified_at is not null) as phone_verified,
    (u.password_hash is not null) as has_password,
    u.lang, u.notify_new, u.notify_price, u.digest, u.created_at
"""


class MiniAppRepo:
    def __init__(self, url: str) -> None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        if "ljkugtpeboomboobodom" in url.lower():
            raise RuntimeError("это складская эко-система — Mini App сюда не подключаем")
        # Кэш ставит API; в скриптах и тестах его может не быть.
        self.cache: Any | None = None
        # Оценка рынка для списков (лента, похожие) стоит ~70 % трафика из базы:
        # на 10 карточек это до 600 сравнимых машин с полями. Пока квота egress
        # впритык, считаем её только в карточке; вернуть спискам —
        # CARCAR_LIST_MARKET=1 в Railway.
        self.list_market = os.environ.get("CARCAR_LIST_MARKET", "0") == "1"
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

    def service_notices(self) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select s.code as source, c.stats->'service_notice' as notice
                from public.source s join public.collector c on c.source_id = s.id
                where c.stats ? 'service_notice'
                  and (c.stats #>> '{service_notice,starts_at}')::timestamptz <= now()
                  and (c.stats #>> '{service_notice,ends_at}')::timestamptz > now()
                order by s.code
                """
            )
            return [
                {"source": row["source"], **row["notice"]}
                for row in cur.fetchall()
                if isinstance(row["notice"], dict)
            ]

    def record_session(self, user_id: int) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """insert into user_activity_daily
                   (user_id, day, sessions, last_session_at, last_active_at)
                   values (%s, current_date, 1, now(), now())
                   on conflict (user_id, day) do update set
                     sessions = user_activity_daily.sessions + case
                       when coalesce(user_activity_daily.last_session_at, '-infinity')
                         < now() - interval '30 minutes'
                         then 1 else 0 end,
                     last_session_at = case
                       when coalesce(user_activity_daily.last_session_at, '-infinity')
                         < now() - interval '30 minutes'
                         then now() else user_activity_daily.last_session_at end,
                     last_active_at = now()""",
                (user_id,),
            )
        conn.commit()

    def record_search(
        self, user_id: int, *, query: str | None, filters: dict[str, Any], sort: str
    ) -> None:
        # Store a privacy-bounded per-user history; coalesce exact retries.
        meta = json.dumps({"query": query, "filters": filters, "sort": sort})
        visitor_id = uuid.uuid5(uuid.NAMESPACE_URL, f"carcar-user:{user_id}")
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """insert into user_activity_daily
                   (user_id, day, searches, last_search_at, last_active_at)
                   values (%s, current_date, 1, now(), now())
                   on conflict (user_id, day) do update set
                     searches = user_activity_daily.searches + case
                       when user_activity_daily.last_search_at > now() - interval '10 seconds'
                       then 0 else 1 end,
                     last_search_at = now(),
                     last_active_at = now()""",
                (user_id,),
            )
            cur.execute(
                """
                insert into funnel_event (user_id, visitor_id, kind, meta)
                select %s, %s, 'search', %s::jsonb
                where not exists (
                    select 1 from funnel_event
                    where user_id = %s and kind = 'search' and meta = %s::jsonb
                      and created_at >= now() - interval '10 seconds'
                )
                """,
                (user_id, visitor_id, meta, user_id, meta),
            )
        conn.commit()

    def user_activity_metrics(
        self, days: int, limit: int, offset: int, query: str | None = None
    ) -> dict[str, Any]:
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
                """select
                    (select count(*) from app_user) as registered_users,
                    (select count(*) from app_user
                      where last_seen_at >= now() - interval '1 day') as dau,
                    (select count(*) from app_user
                      where last_seen_at >= now() - interval '7 days') as wau,
                    (select count(*) from app_user
                      where last_seen_at >= now() - interval '30 days') as mau"""
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
                f"""select u.id, u.username, u.first_name, u.last_name,
                          u.created_at, u.last_seen_at,
                          coalesce(sum(a.sessions), 0)::int sessions,
                          coalesce(sum(a.searches), 0)::int searches,
                          coalesce(sum(a.listing_views), 0)::int listing_views,
                          coalesce(sum(a.favorites_added), 0)::int favorites_added,
                          coalesce(sum(a.subscriptions_created), 0)::int subscriptions_created
                   from app_user u left join user_activity_daily a
                     on a.user_id = u.id and a.day >= current_date - %s
                   {user_filter}
                   group by u.id order by u.last_seen_at desc
                   limit %s offset %s""",
                (days - 1, *user_args, limit, offset),
            )
            users = cur.fetchall()
            cur.execute(f"select count(*) as total from app_user u {user_filter}", user_args)
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
        }

    def user_activity_detail(
        self, user_id: int, days: int = 30, search_limit: int = 100
    ) -> dict[str, Any] | None:
        days = max(1, min(days, 90))
        search_limit = max(1, min(search_limit, 200))
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """select id, username, first_name, last_name, created_at, last_seen_at
                   from app_user where id = %s""",
                (user_id,),
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
                     and day >= current_date - %s
                   order by day desc""",
                (user_id, days - 1),
            )
            daily = [
                {
                    **row,
                    "day": row["day"].isoformat(),
                    "last_active_at": _iso(row["last_active_at"]),
                }
                for row in cur.fetchall()
            ]
            cur.execute(
                """select created_at, meta from funnel_event
                   where user_id = %s and kind = 'search'
                     and created_at >= now() - make_interval(days => %s)
                   order by created_at desc limit %s""",
                (user_id, days, search_limit),
            )
            searches = [
                {"at": _iso(row["created_at"]), **(row["meta"] or {})}
                for row in cur.fetchall()
            ]
        return {
            "user": {
                **user,
                "created_at": _iso(user["created_at"]),
                "last_seen_at": _iso(user["last_seen_at"]),
            },
            "days": days,
            "totals": totals,
            "daily": daily,
            "searches": searches,
        }

    def account_search_history(self, user_id: int) -> list[dict[str, Any]]:
        """All retained search records, for the account's data export."""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """select created_at, meta from funnel_event
                   where user_id = %s and kind = 'search'
                   order by created_at desc""",
                (user_id,),
            )
            return [
                {"searched_at": _iso(row["created_at"]), **(row["meta"] or {})}
                for row in cur.fetchall()
            ]

    # -- воронка -----------------------------------------------------------
    def record_funnel_event(
        self,
        *,
        visitor_id: str,
        kind: str,
        user_id: int | None = None,
        listing_id: int | None = None,
        meta: dict[str, Any] | None = None,
    ) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into funnel_event (user_id, visitor_id, kind, listing_id, meta)
                values (%s, %s, %s, %s, %s::jsonb)
                """,
                (
                    user_id,
                    visitor_id,
                    kind,
                    listing_id,
                    json.dumps(meta, ensure_ascii=False) if meta else None,
                ),
            )
        conn.commit()

    def funnel_metrics(self, days: int = 30) -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select kind,
                       count(*) as events,
                       count(distinct visitor_id) as visitors,
                       count(distinct user_id) as users
                from funnel_event
                where created_at >= now() - make_interval(days => %s)
                group by kind
                order by kind
                """,
                (days,),
            )
            stages = [dict(row) for row in cur.fetchall()]

            cur.execute(
                """
                select created_at::date as day, kind, count(*) as events
                from funnel_event
                where created_at >= now() - make_interval(days => %s)
                group by 1, 2
                order by 1, 2
                """,
                (days,),
            )
            daily = [dict(row) for row in cur.fetchall()]

            cur.execute(
                "select count(*) as total from app_user "
                "where created_at >= now() - make_interval(days => %s)",
                (days,),
            )
            registered = int(cur.fetchone()["total"])

            cur.execute(
                """
                select count(distinct e.user_id) as total
                from funnel_event e
                join app_user u on u.id = e.user_id
                where e.kind in ('saved_search', 'favorite_add')
                  and e.created_at >= u.created_at
                  and e.created_at <= u.created_at + interval '7 days'
                  and u.created_at >= now() - make_interval(days => %s)
                """,
                (days,),
            )
            activated_7d = int(cur.fetchone()["total"])
        return {
            "days": days,
            "registered": registered,
            "activated_7d": activated_7d,
            "stages": stages,
            "daily": daily,
        }

    # -- пользователи ------------------------------------------------------
    def ensure_user(self, tg: dict[str, Any]) -> dict[str, Any]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into app_user (tg_id, username, first_name, last_name)
                values (%s, %s, %s, %s)
                on conflict (tg_id) do update set
                    username = excluded.username,
                    first_name = excluded.first_name,
                    last_name = excluded.last_name,
                    last_seen_at = now()
                returning {USER_FIELDS}
                """,
                (
                    tg["id"],
                    tg.get("username"),
                    tg.get("first_name"),
                    tg.get("last_name"),
                ),
            )
            row = cur.fetchone()
            # Telegram-аккаунт сразу получает identity: дальше он находится
            # одинаково с Google/Facebook, без спецкейса по tg_id.
            if row:
                cur.execute(
                    """
                    insert into user_identity (user_id, provider, subject)
                    values (%s, 'telegram', %s)
                    on conflict (provider, subject) do update set
                        last_login_at = now()
                    where user_identity.user_id = excluded.user_id
                    """,
                    (row["id"], str(tg["id"])),
                )
        conn.commit()
        return dict(row)

    def get_user(self, user_id: int) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {USER_FIELDS} from app_user where id = %s",
                (user_id,),
            )
            row = cur.fetchone()
        return dict(row) if row else None

    def delete_user(self, user_id: int) -> bool:
        with self.pool.connection() as conn, conn.cursor() as cur:
            # Search rows contain user-entered terms and must not be anonymized
            # into retained funnel data when the account is deleted.
            cur.execute(
                "delete from funnel_event where user_id = %s and kind = 'search'",
                (user_id,),
            )
            cur.execute("delete from app_user where id = %s", (user_id,))
            deleted = cur.rowcount
        conn.commit()
        return bool(deleted)

    def update_user(self, user_id: int, **fields: Any) -> dict[str, Any]:
        allowed = {"lang", "notify_new", "notify_price", "digest"}
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

    # -- веб-пользователи --------------------------------------------------
    def create_web_user(
        self,
        email: str,
        password_hash: str,
        first_name: str | None = None,
    ) -> dict[str, Any] | None:
        """Создаёт пользователя по e-mail. None — адрес уже занят."""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into app_user (email, password_hash, first_name)
                values (%s, %s, %s)
                on conflict do nothing
                returning {USER_FIELDS}
                """,
                (email, password_hash, first_name),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None

    def user_for_login(self, login: str) -> dict[str, Any] | None:
        """Ищет по e-mail или подтверждённому телефону и отдаёт хеш пароля."""
        with self.pool.connection() as conn, conn.cursor() as cur:
            if "@" in login:
                cur.execute(
                    f"select {USER_FIELDS}, password_hash from app_user "
                    "where lower(email) = lower(%s)",
                    (login,),
                )
            else:
                cur.execute(
                    f"select {USER_FIELDS}, password_hash from app_user "
                    "where phone = %s and phone_verified_at is not null",
                    (login,),
                )
            row = cur.fetchone()
        return dict(row) if row else None

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {USER_FIELDS} from app_user where lower(email) = lower(%s)",
                (email,),
            )
            row = cur.fetchone()
        return dict(row) if row else None

    def get_user_by_phone(self, phone: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {USER_FIELDS} from app_user "
                "where phone = %s and phone_verified_at is not null",
                (phone,),
            )
            row = cur.fetchone()
        return dict(row) if row else None

    def set_password(self, user_id: int, password_hash: str) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update app_user set password_hash = %s, auth_version = auth_version + 1, "
                "last_seen_at = now() where id = %s",
                (password_hash, user_id),
            )
            cur.execute(
                "update web_session set revoked_at = now() "
                "where user_id = %s and revoked_at is null",
                (user_id,),
            )
        conn.commit()

    def user_auth_version(self, user_id: int) -> int:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute("select auth_version from app_user where id = %s", (user_id,))
            row = cur.fetchone()
        return int(row["auth_version"]) if row else -1

    def mark_email_verified(self, user_id: int, email: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                update app_user set email_verified_at = now()
                where id = %s and lower(email) = lower(%s)
                returning {USER_FIELDS}
                """,
                (user_id, email),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None

    def attach_verified_phone(self, user_id: int, phone: str) -> dict[str, Any] | None:
        """Закрепляет телефон за пользователем.

        Уникальный индекс `app_user_phone_key` не даст двум аккаунтам один
        номер: гонку двух одновременных подтверждений разрешает база, а не
        проверка «свободен ли номер» в приложении.
        """
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                update app_user set phone = %s, phone_verified_at = now()
                where id = %s
                returning {USER_FIELDS}
                """,
                (phone, user_id),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None

    # -- cookie-сессии -----------------------------------------------------
    def create_web_session(
        self,
        user_id: int,
        token_hash: str,
        csrf_hash: str,
        *,
        ttl: int,
        user_agent: str | None = None,
    ) -> int:
        with self.pool.connection() as conn, conn.cursor() as cur:
            # Держим таблицу маленькой: старые сессии не нужны ни для чего.
            cur.execute(
                "delete from web_session where expires_at < now() - interval '30 days'"
            )
            cur.execute(
                """
                insert into web_session
                    (user_id, token_hash, csrf_hash, user_agent, expires_at)
                values (%s, %s, %s, %s, now() + make_interval(secs => %s))
                returning id
                """,
                (user_id, token_hash, csrf_hash, (user_agent or "")[:300] or None, float(ttl)),
            )
            session_id = int(cur.fetchone()["id"])
        conn.commit()
        return session_id

    def get_web_session(self, token_hash: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select s.id as session_id, s.csrf_hash, s.expires_at,
                       {SESSION_USER_FIELDS}
                from web_session s
                join app_user u on u.id = s.user_id
                where s.token_hash = %s
                  and s.revoked_at is null
                  and s.expires_at > now()
                """,
                (token_hash,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cur.execute(
                """
                update web_session set last_seen_at = now()
                where id = %s and last_seen_at < now() - interval '5 minutes'
                """,
                (row["session_id"],),
            )
        conn.commit()
        data = dict(row)
        user = {key: data[key] for key in USER_KEYS}
        return {
            "session_id": data["session_id"],
            "csrf_hash": data["csrf_hash"],
            "expires_at": data["expires_at"],
            "user": user,
        }

    def rotate_session_csrf(self, session_id: int, csrf_hash: str) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update web_session set csrf_hash = %s where id = %s",
                (csrf_hash, session_id),
            )
        conn.commit()

    def revoke_web_session(self, session_id: int) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update web_session set revoked_at = now() where id = %s and revoked_at is null",
                (session_id,),
            )
        conn.commit()

    def revoke_user_sessions(self, user_id: int, *, except_id: int | None = None) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update web_session set revoked_at = now() "
                "where user_id = %s and revoked_at is null and id <> %s",
                (user_id, except_id or 0),
            )
        conn.commit()

    # -- одноразовые ссылки и SMS-коды -------------------------------------
    def issue_auth_token(
        self,
        user_id: int,
        kind: str,
        destination: str,
        *,
        ttl: int,
        token_hash: str | None = None,
        code_hash: str | None = None,
    ) -> int:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "delete from auth_token where expires_at < now() - interval '7 days'"
            )
            # Старые живые токены того же назначения гасим: у человека должна
            # быть ровно одна действующая ссылка/код.
            if kind in {"email_change", "telegram_link"}:
                # У смены почты и привязки Telegram должен жить ровно один
                # токен: иначе старая ссылка на прежний адрес вернёт его назад.
                cur.execute(
                    "update auth_token set consumed_at = now() "
                    "where user_id = %s and kind = %s and consumed_at is null",
                    (user_id, kind),
                )
            else:
                cur.execute(
                    "update auth_token set consumed_at = now() "
                    "where user_id = %s and kind = %s and destination = %s "
                    "and consumed_at is null",
                    (user_id, kind, destination),
                )
            cur.execute(
                """
                insert into auth_token
                    (user_id, kind, destination, token_hash, code_hash, expires_at)
                values (%s, %s, %s, %s, %s, now() + make_interval(secs => %s))
                returning id
                """,
                (user_id, kind, destination, token_hash, code_hash, float(ttl)),
            )
            token_id = int(cur.fetchone()["id"])
        conn.commit()
        return token_id

    def consume_auth_token(self, kind: str, token_hash: str) -> dict[str, Any] | None:
        """Атомарно гасит ссылку: два параллельных перехода не сработают оба."""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                update auth_token set consumed_at = now()
                where kind = %s and token_hash = %s
                  and consumed_at is null and expires_at > now()
                returning user_id, destination
                """,
                (kind, token_hash),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None

    def latest_phone_code(self, kind: str, destination: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select id, code_hash, attempts
                from auth_token
                where kind = %s and destination = %s
                  and consumed_at is null and expires_at > now()
                order by created_at desc limit 1
                """,
                (kind, destination),
            )
            row = cur.fetchone()
        return dict(row) if row else None

    def bump_auth_attempts(self, token_id: int) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update auth_token set attempts = attempts + 1 where id = %s",
                (token_id,),
            )
        conn.commit()

    def consume_auth_token_id(self, token_id: int) -> None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "update auth_token set consumed_at = now() "
                "where id = %s and consumed_at is null",
                (token_id,),
            )
        conn.commit()

    def count_recent_tokens(self, kind: str, destination: str, seconds: int) -> int:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "select count(*) as total from auth_token "
                "where kind = %s and destination = %s "
                "and created_at > now() - make_interval(secs => %s)",
                (kind, destination, float(seconds)),
            )
            row = cur.fetchone()
        return int(row["total"])

    # -- связанные входы ---------------------------------------------------
    def get_identity(self, provider: str, subject: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                select i.user_id, i.email as identity_email, {SESSION_USER_FIELDS}
                from user_identity i
                join app_user u on u.id = i.user_id
                where i.provider = %s and i.subject = %s
                """,
                (provider, subject),
            )
            row = cur.fetchone()
            if not row:
                return None
            cur.execute(
                "update user_identity set last_login_at = now() "
                "where provider = %s and subject = %s",
                (provider, subject),
            )
        conn.commit()
        data = dict(row)
        user = {key: data[key] for key in USER_KEYS}
        return {
            "provider": provider,
            "subject": subject,
            "email": data["identity_email"],
            "user": user,
        }

    def list_identities(self, user_id: int) -> list[dict[str, Any]]:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select provider, email, created_at, last_login_at
                from user_identity where user_id = %s
                order by created_at
                """,
                (user_id,),
            )
            rows = cur.fetchall()
        return [dict(row) for row in rows]

    def attach_identity(
        self,
        user_id: int,
        provider: str,
        subject: str,
        email: str | None = None,
    ) -> bool:
        """Привязывает identity. False — она уже принадлежит другому человеку."""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into user_identity (user_id, provider, subject, email)
                values (%s, %s, %s, %s)
                on conflict (provider, subject) do update set
                    last_login_at = now(),
                    email = coalesce(excluded.email, user_identity.email)
                where user_identity.user_id = excluded.user_id
                returning user_id
                """,
                (user_id, provider, subject, email),
            )
            row = cur.fetchone()
        conn.commit()
        return bool(row)

    def get_user_by_tg(self, tg_id: int) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {USER_FIELDS} from app_user where tg_id = %s",
                (tg_id,),
            )
            row = cur.fetchone()
        return dict(row) if row else None

    def link_telegram(self, user_id: int, tg: dict[str, Any]) -> dict[str, Any] | None:
        """Привязывает Telegram к уже существующему веб-аккаунту.

        None — этот Telegram (или у аккаунта уже есть другой Telegram) занят.
        """
        tg_id = int(tg["id"])
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "select tg_id from app_user where id = %s for update",
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            if row["tg_id"] is not None and int(row["tg_id"]) != tg_id:
                return None

            cur.execute(
                "select id from app_user where tg_id = %s and id <> %s",
                (tg_id, user_id),
            )
            if cur.fetchone():
                return None

            cur.execute(
                "select user_id from user_identity "
                "where provider = 'telegram' and subject = %s",
                (str(tg_id),),
            )
            existing = cur.fetchone()
            if existing and int(existing["user_id"]) != user_id:
                return None

            cur.execute(
                f"""
                update app_user set
                    tg_id = %s,
                    username = coalesce(username, %s),
                    first_name = coalesce(first_name, %s),
                    last_name = coalesce(last_name, %s),
                    last_seen_at = now()
                where id = %s
                returning {USER_FIELDS}
                """,
                (
                    tg_id,
                    tg.get("username"),
                    tg.get("first_name"),
                    tg.get("last_name"),
                    user_id,
                ),
            )
            updated = cur.fetchone()
            cur.execute(
                """
                insert into user_identity (user_id, provider, subject)
                values (%s, 'telegram', %s)
                on conflict (provider, subject) do update set
                    last_login_at = now()
                """,
                (user_id, str(tg_id)),
            )
        conn.commit()
        return dict(updated) if updated else None

    def create_social_user(
        self,
        email: str,
        first_name: str | None = None,
        *,
        email_verified: bool,
    ) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                insert into app_user (email, first_name, email_verified_at)
                values (%s, %s, case when %s then now() else null end)
                on conflict do nothing
                returning {USER_FIELDS}
                """,
                (email, first_name, email_verified),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None

    def set_email_verified(self, user_id: int, email: str) -> dict[str, Any] | None:
        """Меняет почту и сразу помечает её подтверждённой (ссылка из письма)."""
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                update app_user
                set email = %s, email_verified_at = now(), last_seen_at = now()
                where id = %s
                returning {USER_FIELDS}
                """,
                (email, user_id),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None

    # -- объявления ----------------------------------------------------------
    def _market_analyses(self, rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
        """Оценка рынка для ленты тем же взвешенным моделью, что и карточка.

        Раньше лента брала медиану из model_option по всем годам модели —
        «новый BMW выше рынка» из-за сравнения с 2005-м, а вердикт расходился
        с отчётом на карточке. Здесь одним запросом собираем до 60 похожих
        на каждую карточку и считаем analyse_price; 20 машин — около 0.25 c,
        а выдача всё равно кэшируется на 2 минуты.
        """
        ids = [
            row["id"] for row in rows if row.get("price") and row.get("make") and row.get("model")
        ]
        if not ids:
            return {}

        prices = {row["id"]: row.get("price") for row in rows}
        cached: dict[int, dict[str, Any]] = {}
        if self.cache is not None:
            pending = []
            for item_id in ids:
                key = f"market:v3:{item_id}:{prices[item_id]}"
                hit = self.cache.get(key)
                if hit:
                    cached[item_id] = hit
                else:
                    pending.append(item_id)
            ids = pending
            if not ids:
                return cached

        subject_fields = """
            l.id, l.make, l.model, l.title, l.price, l.year, l.mileage_km,
            l.engine_cm3, l.power_hp, l.body, l.gearbox, l.drive, l.fuel,
            l.color, l.generation, l.equipment
        """
        # Комплектация весит 5 % в модели, но занимает 87 % трафика: полный
        # список опций — это ~1.1 КБ на машину, а машин на страницу до 600.
        # Первых восьми пунктов достаточно, чтобы отличить «богатую» от «пустой».
        comp_fields = """
            c.id, c.title, c.price, c.year, c.mileage_km, c.engine_cm3,
            c.power_hp, c.body, c.gearbox, c.drive, c.fuel, c.color,
            c.generation, c.equipment[1:8] as equipment
        """
        near = f"""
            with page as (
                select {subject_fields}
                from listing l where l.id = any(%(ids)s::bigint[])
            ),
            comps as (
                select p.id as subject_id, {comp_fields},
                       row_number() over (
                         partition by p.id
                         order by abs(c.year - p.year) nulls last,
                                  abs(c.mileage_km - p.mileage_km) nulls last
                       ) as rn
                from page p
                join listing c
                  on c.make = p.make and c.model = p.model
                 and c.status = 'active' and c.price is not null
                 and c.id <> p.id
                 and (p.year is null or c.year between p.year - 6 and p.year + 6)
                 and (
                   p.mileage_km is null
                   or c.mileage_km between p.mileage_km * 0.4 and p.mileage_km * 1.8
                 )
            )
            select * from comps where rn <= 60
        """
        broad = f"""
            with page as (
                select {subject_fields}
                from listing l where l.id = any(%(ids)s::bigint[])
            ),
            comps as (
                select p.id as subject_id, {comp_fields},
                       row_number() over (
                         partition by p.id
                         order by abs(c.price - p.price) nulls last
                       ) as rn
                from page p
                join listing c
                  on c.make = p.make and c.model = p.model
                 and c.status = 'active' and c.price is not null
                 and c.id <> p.id
            )
            select * from comps where rn <= 60
        """
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"select {subject_fields} from listing l where l.id = any(%(ids)s::bigint[])",
                {"ids": ids},
            )
            subjects = {row["id"]: dict(row) for row in cur.fetchall()}
            cur.execute(near, {"ids": ids})
            grouped: dict[int, list[dict[str, Any]]] = {}
            for row in cur.fetchall():
                grouped.setdefault(row.pop("subject_id"), []).append(dict(row))
            thin = [item_id for item_id in ids if len(grouped.get(item_id, [])) < 8]
            if thin:
                cur.execute(broad, {"ids": thin})
                # Карточка при недоборе заменяет выборку, а не копит её.
                fresh: dict[int, list[dict[str, Any]]] = {}
                for row in cur.fetchall():
                    fresh.setdefault(row.pop("subject_id"), []).append(dict(row))
                grouped.update(fresh)

        result: dict[int, dict[str, Any]] = dict(cached)
        for item_id in ids:
            subject = subjects.get(item_id)
            if not subject:
                continue
            analysis = analyse_price(_infer_subject_features(subject), grouped.get(item_id, []))
            if not analysis:
                continue
            result[item_id] = {
                "median": analysis["median"],
                "p10": analysis["p10"],
                "p90": analysis["p90"],
                "sample": analysis["sample"],
                "diff_pct": analysis["diff_pct"],
                "verdict": analysis["verdict"],
            }
            if self.cache is not None:
                self.cache.set(
                    f"market:v3:{item_id}:{prices[item_id]}",
                    result[item_id],
                    ttl=21_600,
                )
        return result

    def search(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        q: str | None = None,
        make: str | None = None,
        makes: list[str] | None = None,
        model: str | None = None,
        price_min: int | None = None,
        price_max: int | None = None,
        year_min: int | None = None,
        year_max: int | None = None,
        mileage_min: int | None = None,
        mileage_max: int | None = None,
        fuel: str | None = None,
        fuels: list[str] | None = None,
        gearbox: str | None = None,
        gearboxes: list[str] | None = None,
        body: str | None = None,
        bodies: list[str] | None = None,
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
        published_days: int | None = None,
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
            # Пользовательский % и _ — это символы, а не маски LIKE.
            term = q.replace("!", "!!").replace("%", "!%").replace("_", "!_")
            conds.append(
                "(l.title ILIKE %(q)s ESCAPE '!' "
                "OR l.make ILIKE %(q)s ESCAPE '!' "
                "OR l.model ILIKE %(q)s ESCAPE '!')"
            )
            params["q"] = f"%{term}%"
        if makes:
            # Мультивыбор онбординга: любая из выбранных марок.
            conds.append("l.make = ANY(%(makes)s)")
            params["makes"] = makes
        elif make:
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
        if fuels:
            conds.append("l.fuel = ANY(%(fuels)s)")
            params["fuels"] = fuels
        elif fuel:
            conds.append("l.fuel = %(fuel)s")
            params["fuel"] = fuel
        if gearboxes:
            conds.append("l.gearbox = ANY(%(gearboxes)s)")
            params["gearboxes"] = gearboxes
        elif gearbox:
            conds.append("l.gearbox = %(gearbox)s")
            params["gearbox"] = gearbox
        if bodies:
            conds.append("l.body = ANY(%(bodies)s)")
            params["bodies"] = bodies
        elif body:
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
        if published_days:
            conds.append("l.published_at >= now() - make_interval(days => %(published_days)s)")
            params["published_days"] = published_days

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
            "year_desc": "year desc nulls last, published_at desc",
            "mileage_asc": "mileage_km asc nulls last, published_at desc",
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
        if limit > 1 and self.list_market:
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
                order by observed_at asc
                """,
                (listing_id,),
            )
            events_all = [
                {
                    "kind": e["kind"],
                    "old_price": _num(e["old_price"]),
                    "new_price": _num(e["new_price"]),
                    "observed_at": _iso(e["observed_at"]),
                }
                for e in cur.fetchall()
            ]
            # Для бейджа нужны последние изменения, для истории — все.
            events = list(reversed(events_all[-10:]))
            price_history, initial_price = _price_history(row, events_all)

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

        return _card(row, events, analysis, price_history, initial_price)

    def _similar_rows(self, cur: Any, subject: dict[str, Any], limit: int) -> list[dict[str, Any]]:
        """Кандидаты «похожих» в три круга: точная модель → модель → марка.

        Первый круг отсекает годы и цену, чтобы не показывать машину другого
        класса; второй ослабляет ограничения, если модель редкая; третий
        добирает ту же марку и кузов. Дубликаты между кругами убираем.
        """
        make = subject["make"]
        model = (subject.get("model") or "").strip()
        generic_model = not model or model.lower() in GENERIC_MODELS
        price = _num(subject.get("price"))
        year = subject.get("year")
        body = subject.get("body")

        base = [
            "l.status = 'active'",
            "l.published_at is not null",
            "l.id <> %(id)s",
            "l.make = %(make)s",
        ]
        shared: dict[str, Any] = {"id": subject["id"], "make": make}
        if not generic_model:
            base.append("l.model = %(model)s")
            shared["model"] = model
        rank: list[str] = []
        if body:
            shared["body"] = body
            rank.append("(l.body is distinct from %(body)s)::int")
        if year:
            shared["year"] = year
            rank.append("abs(l.year - %(year)s) nulls last")
        if price:
            shared["price"] = price
            rank.append(
                "abs(l.price - %(price)s::numeric) / greatest(%(price)s::numeric, 1) nulls last"
            )
        rank.append("l.published_at desc")

        tiers: list[tuple[list[str], dict[str, Any], str]] = []

        if not generic_model:
            tight = dict(shared)
            tight_conds = list(base)
            if price:
                tight["price_lo"] = int(price * 0.65)
                tight["price_hi"] = int(price * 1.35)
                tight_conds.append("l.price between %(price_lo)s and %(price_hi)s")
            if year:
                tight["year_lo"] = int(year) - 3
                tight["year_hi"] = int(year) + 3
                tight_conds.append("l.year between %(year_lo)s and %(year_hi)s")
            tiers.append((tight_conds, tight, ", ".join(rank)))
            tiers.append((list(base), dict(shared), ", ".join(rank)))

        wide: dict[str, Any] = {"id": subject["id"], "make": make}
        wide_conds = [
            "l.status = 'active'",
            "l.published_at is not null",
            "l.id <> %(id)s",
            "l.make = %(make)s",
        ]
        wide_rank: list[str] = []
        if body:
            wide["body"] = body
            wide_conds.append("l.body = %(body)s")
        if price:
            wide["price"] = price
            wide["price_lo"] = int(price * 0.5)
            wide["price_hi"] = int(price * 1.5)
            wide_conds.append("l.price between %(price_lo)s and %(price_hi)s")
            wide_rank.append("abs(l.price - %(price)s::numeric) nulls last")
        if year:
            wide["year"] = year
            wide_rank.append("abs(l.year - %(year)s) nulls last")
        wide_rank.append("l.published_at desc")
        tiers.append((wide_conds, wide, ", ".join(wide_rank)))

        if generic_model:
            # «Inny» без кузова: лучше показать ту же марку в том же бюджете,
            # чем пустую секцию.
            relaxed: dict[str, Any] = {"id": subject["id"], "make": make}
            relaxed_conds = [
                "l.status = 'active'",
                "l.published_at is not null",
                "l.id <> %(id)s",
                "l.make = %(make)s",
            ]
            relaxed_rank: list[str] = []
            if price:
                relaxed["price"] = price
                relaxed["price_lo"] = int(price * 0.5)
                relaxed["price_hi"] = int(price * 1.5)
                relaxed_conds.append("l.price between %(price_lo)s and %(price_hi)s")
                relaxed_rank.append("abs(l.price - %(price)s::numeric) nulls last")
            if year:
                relaxed["year"] = year
                relaxed_rank.append("abs(l.year - %(year)s) nulls last")
            relaxed_rank.append("l.published_at desc")
            tiers.append((relaxed_conds, relaxed, ", ".join(relaxed_rank)))

        found: list[dict[str, Any]] = []
        seen: set[int] = set()
        for conds, params, order in tiers:
            if len(found) >= limit:
                break
            # Третий круг — только когда одноклассников совсем мало.
            if conds is wide_conds and len(found) >= 3:
                break
            query_params = dict(params, limit=limit - len(found))
            cur.execute(
                f"""
                select {LIST_FIELDS}, s.code as source_code,
                       null::float8 as distance_km
                from listing l join source s on s.id = l.source_id
                where {" and ".join(conds)}
                order by {order}
                limit %(limit)s
                """,
                query_params,
            )
            for row in cur.fetchall():
                if row["id"] in seen:
                    continue
                seen.add(row["id"])
                found.append(row)
        return found

    def similar(self, listing_id: int, limit: int = 6) -> list[dict[str, Any]] | None:
        """Похожие авто для карточки. None — такого объявления нет (404)."""
        limit = max(1, min(limit, 12))
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, make, model, year, mileage_km, price, body from listing where id = %s",
                (listing_id,),
            )
            subject = cur.fetchone()
            if not subject:
                return None
            if not subject.get("make"):
                return []
            rows = self._similar_rows(cur, subject, limit)

        items = [_item(row) for row in rows]
        if items:
            # Ленте похожих хватает одного фото: не тащим 6 URL на каждую карточку.
            for item in items:
                item["photos"] = item["photos"][:1]
            if self.list_market:
                try:
                    analyses = self._market_analyses(rows)
                except Exception:
                    # Оценка рынка вспомогательная: без неё список всё равно нужен.
                    analyses = {}
                for item in items:
                    analysis = analyses.get(item["id"])
                    if analysis:
                        item["price_analysis"] = analysis
        return items

    # -- просмотры, реакции, популярность -----------------------------------
    def record_impressions(self, listing_ids: list[int]) -> None:
        """Показ объявления в выдаче: поиск и лента.

        Именно показ отличает «видел в списке» от «открыл карточку»: без него
        CTR посчитать нельзя, и объявление, которое никто не открывает, ничем
        не хуже того, которое открывают. Один запрос на пачку.
        """
        ids = sorted({int(listing_id) for listing_id in listing_ids if listing_id})
        if not ids:
            return
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into listing_stat (listing_id, impressions)
                select id, 1 from unnest(%s::bigint[]) as id
                on conflict (listing_id) do update set
                    impressions = listing_stat.impressions + 1,
                    updated_at = now()
                """,
                (ids,),
            )
        conn.commit()

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
                    """insert into user_activity_daily
                       (user_id, day, listing_views, last_active_at)
                       values (%s, current_date, 1, now())
                       on conflict (user_id, day) do update set
                         listing_views = user_activity_daily.listing_views + 1,
                         last_active_at = now()""",
                    (user_id,),
                )
                cur.execute(
                    """
                    insert into listing_stat (listing_id, views)
                    values (%s, 1)
                    on conflict (listing_id) do update set
                        views = listing_stat.views + 1,
                        updated_at = now()
                    returning views
                    """,
                    (listing_id,),
                )
                views = int(cur.fetchone()["views"])
            else:
                cur.execute("select views from listing_stat where listing_id = %s", (listing_id,))
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
                        insert into listing_stat (listing_id, likes)
                        values (%s, 1)
                        on conflict (listing_id) do update set
                            likes = listing_stat.likes + 1,
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
                            updated_at = now()
                        where listing_id = %s
                        """,
                        (listing_id,),
                    )
            cur.execute("select likes from listing_stat where listing_id = %s", (listing_id,))
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
                    insert into listing_stat (listing_id, reposts)
                    values (%s, 1)
                    on conflict (listing_id) do update set
                        reposts = listing_stat.reposts + 1,
                        updated_at = now()
                    """,
                    (listing_id,),
                )
            cur.execute("select reposts from listing_stat where listing_id = %s", (listing_id,))
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
                insert into listing_stat (listing_id, comments)
                values (%s, 1)
                on conflict (listing_id) do update set
                    comments = listing_stat.comments + 1,
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
        """Вкус пользователя: сохранённые фильтры + просмотры + лайки + избранное."""

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
                    price_max = (
                        int(criteria["price_max"])
                        if price_max is None
                        else max(price_max, int(criteria["price_max"]))
                    )

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

            # Избранное — осознанный выбор: «сохранил себе» весит больше лайка,
            # иначе подборка учится на случайных тапах в ленте.
            cur.execute(
                """
                select l.make, l.body, l.fuel
                from favorite f join listing l on l.id = f.listing_id
                where f.user_id = %s order by f.created_at desc limit 50
                """,
                (user_id,),
            )
            for row in cur.fetchall():
                if row["make"]:
                    makes[row["make"]] = makes.get(row["make"], 0) + 5
                if row["body"]:
                    bodies[row["body"]] = bodies.get(row["body"], 0) + 4
                if row["fuel"]:
                    fuels[row["fuel"]] = fuels.get(row["fuel"], 0) + 3

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
            # Один порядок в обоих режимах: интерес (единый score) с поправкой
            # на свежесть. Раньше for_you с вкусом сортировал только по дате,
            # поэтому лайки, просмотры и избранное влияли лишь на «popular».
            order = f"{SCORE_ORDER} desc, l.published_at desc nulls last"
            sql = f"""
                select {LIST_FIELDS}, s.code as source_code,
                       coalesce(st.views, 0) views,
                       coalesce(st.likes, 0) likes,
                       coalesce(st.comments, 0) comments,
                       coalesce(st.reposts, 0) reposts
                from listing l
                join source s on s.id = l.source_id
                left join listing_stat st on st.listing_id = l.id
                where {" and ".join(conds)}
                order by {order}
                limit %(limit)s offset %(offset)s
            """
            cur.execute(sql, params)
            rows = cur.fetchall()

        if rows:
            # Карточки реально показаны в ленте — это показы, а не открытия.
            self.record_impressions([int(row["id"]) for row in rows])

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
        if rows and self.list_market:
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
        """Марки + популярность у пользователей.

        `count` — активные объявления, `users` — сколько разных людей выбрали
        марку в избранном или сохранённом поиске. Для пузырей онбординга важнее
        второе; при пустой базе фронт откатывается на `count`.
        """
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                with picks as (
                    select f.user_id, l.make
                    from favorite f
                    join listing l on l.id = f.listing_id
                    where l.make is not null and l.make <> ''
                    union all
                    select s.user_id, s.criteria->>'make'
                    from subscription s
                    where s.criteria->>'make' is not null
                      and s.criteria->>'make' <> ''
                    union all
                    select s.user_id, value
                    from subscription s
                    cross join lateral jsonb_array_elements_text(
                        case
                            when jsonb_typeof(s.criteria->'makes') = 'array'
                            then s.criteria->'makes'
                            else '[]'::jsonb
                        end
                    ) as value
                ), counts as (
                    select make, count(distinct user_id) as users
                    from picks
                    where make is not null and make <> ''
                    group by make
                )
                select l.make, count(*) as n, coalesce(c.users, 0) as users
                from listing l
                left join counts c on lower(c.make) = lower(l.make)
                where l.status = 'active' and l.make is not null and l.make <> ''
                group by l.make, c.users
                having count(*) >= 3
                order by n desc
                """
            )
            return [
                {"value": r["make"], "count": r["n"], "users": int(r["users"])}
                for r in cur.fetchall()
            ]

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
            conditions = [{"value": r["condition"], "count": int(r["n"])} for r in cur.fetchall()]

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
            cur.execute(
                """insert into user_activity_daily
                   (user_id, day, subscriptions_created, last_active_at)
                   values (%s, current_date, 1, now())
                   on conflict (user_id, day) do update set
                     subscriptions_created = user_activity_daily.subscriptions_created + 1,
                     last_active_at = now()""",
                (user_id,),
            )
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
        return next((s for s in self.subscriptions(user_id) if s["id"] == sub_id), None)

    def get_subscription(self, user_id: int, sub_id: int) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select id, name, criteria, active, created_at
                from subscription where id = %s and user_id = %s
                """,
                (sub_id, user_id),
            )
            row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "criteria": row["criteria"],
            "active": row["active"],
            "created_at": _iso(row["created_at"]),
        }

    def find_listing_for_criteria(self, criteria: dict[str, Any]) -> dict[str, Any] | None:
        """Одна машина под фильтр — для демо-алерта и превью онбординга."""
        allowed = {
            "q", "make", "model", "price_min", "price_max", "year_min", "year_max",
            "mileage_min", "mileage_max", "fuel", "fuels", "gearbox", "gearboxes",
            "body", "bodies", "makes", "drive", "condition", "seller_type",
            "color", "doors", "seats", "power_min", "power_max", "engine_min",
            "engine_max", "source", "published_days",
            "lat", "lon", "radius_km", "sort",
        }
        kwargs = {
            key: value
            for key, value in (criteria or {}).items()
            if key in allowed and value not in (None, "")
        }
        if "sort" not in kwargs:
            kwargs["sort"] = "new"
        items, _, _ = self.search(limit=1, offset=0, **kwargs)
        return items[0] if items else None

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
                select {FIELDS}, s.code as source_code, null::float8 as distance_km,
                       f.status as favorite_status, f.note as favorite_note
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
        for row, item in zip(rows, items, strict=True):
            item["favorite_status"] = row.get("favorite_status") or "shortlist"
            item["favorite_note"] = row.get("favorite_note")
        if rows and self.list_market:
            try:
                analyses = self._market_analyses(rows)
            except Exception:
                analyses = {}
            for item in items:
                analysis = analyses.get(item["id"])
                if analysis:
                    item["price_analysis"] = analysis
        return items

    def get_favorite(self, user_id: int, listing_id: int) -> dict[str, Any] | None:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "select status, note from favorite where user_id = %s and listing_id = %s",
                (user_id, listing_id),
            )
            row = cur.fetchone()
        return dict(row) if row else None

    def update_favorite(
        self,
        user_id: int,
        listing_id: int,
        *,
        status: str | None = None,
        note: str | None = None,
    ) -> dict[str, Any] | None:
        sets, params = [], {"user_id": user_id, "listing_id": listing_id}
        if status is not None:
            sets.append("status = %(status)s")
            params["status"] = status
        if note is not None:
            sets.append("note = %(note)s")
            params["note"] = note.strip()[:500] or None
        if not sets:
            return None
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"update favorite set {', '.join(sets)} "
                "where user_id = %(user_id)s and listing_id = %(listing_id)s "
                "returning status, note",
                params,
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None

    def add_favorite(self, user_id: int, listing_id: int) -> bool:
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into favorite (user_id, listing_id) values (%s, %s) "
                "on conflict do nothing returning 1",
                (user_id, listing_id),
            )
            added = cur.fetchone()
            if added:
                cur.execute(
                    """insert into user_activity_daily
                       (user_id, day, favorites_added, last_active_at)
                       values (%s, current_date, 1, now())
                       on conflict (user_id, day) do update set
                         favorites_added = user_activity_daily.favorites_added + 1,
                         last_active_at = now()""",
                    (user_id,),
                )
                # Счётчик favorites ведёт триггер favorite_stat_counter:
                # каскадное удаление пользователя тоже не оставит его врать.
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
