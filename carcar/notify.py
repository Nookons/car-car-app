"""Матчинг подписок и отправка объявлений в Telegram.

Поток: событие `listing.created` → воркер → подписки пользователей →
уведомление в таблицу `notification` (дедуп по user+listing) → отправка.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import psycopg
from psycopg.rows import dict_row

from .messages import digest, grid_caption
from .messages import messages as msg

log = logging.getLogger("carcar.notify")

# Паузы между попытками: 1 мин → 5 → 15 → 1 ч → 6 ч; после 6 попыток — dead.
BACKOFF_SECONDS = (60, 300, 900, 3600, 21600)
MAX_ATTEMPTS = 6
HOURLY_CAP = 10  # больше 10 сообщений в час одному человеку — перебор


def retry_delay(attempts: int) -> int:
    index = min(max(attempts - 1, 0), len(BACKOFF_SECONDS) - 1)
    return BACKOFF_SECONDS[index]


def _num(value: Any) -> int | None:
    return None if value is None else int(value)


def matches(criteria: dict[str, Any], row: dict[str, Any]) -> bool:
    """Подходит ли объявление под критерии подписки."""
    if not criteria:
        return True

    def text_equal(field: str, value: str) -> bool:
        current = (row.get(field) or "").lower()
        return current == value.lower()

    if criteria.get("make") and not text_equal("make", criteria["make"]):
        return False
    if criteria.get("model") and not text_equal("model", criteria["model"]):
        return False
    price = row.get("price")
    if criteria.get("price_min") is not None and (price is None or price < criteria["price_min"]):
        return False
    if criteria.get("price_max") is not None and (price is None or price > criteria["price_max"]):
        return False
    year = row.get("year")
    if criteria.get("year_min") is not None and (year is None or year < criteria["year_min"]):
        return False
    if criteria.get("year_max") is not None and (year is None or year > criteria["year_max"]):
        return False
    mileage = row.get("mileage_km")
    if criteria.get("mileage_max") is not None and (
        mileage is None or mileage > criteria["mileage_max"]
    ):
        return False
    for field in ("fuel", "gearbox", "body"):
        if criteria.get(field) and not text_equal(field, criteria[field]):
            return False
    return True


class Notifier:
    def __init__(
        self,
        dsn: str,
        bot_token: str,
        public_url: str = "https://car-car-app.vercel.app",
    ) -> None:
        self.dsn = dsn
        self.bot_token = bot_token
        self.public_url = public_url.rstrip("/")
        self.client = httpx.Client(timeout=15)
        self._last_global = 0.0
        self._last_chat: dict[int, float] = {}

    # -- данные ---------------------------------------------------------
    def connect(self) -> psycopg.Connection:
        return psycopg.connect(
            self.dsn,
            connect_timeout=15,
            row_factory=dict_row,
            prepare_threshold=None,
        )

    def listing(
        self, conn: psycopg.Connection, source: str, external_id: str
    ) -> dict[str, Any] | None:
        with conn.cursor() as cur:
            cur.execute(
                """
                select l.id, l.external_id, l.title, l.price, l.currency, l.year,
                       l.mileage_km, l.city, l.make, l.model,
                       l.fuel, l.gearbox, l.body, l.thumb_url, l.url,
                       l.engine_cm3, l.power_hp, l.drive, l.color, l.doors, l.seats,
                       l.condition, l.co2_gkm, l.consumption_urban, l.consumption_extra,
                       l.seller_name,
                       s.code as source_code
                from listing l join source s on s.id = l.source_id
                where s.code = %s and l.external_id = %s and l.status = 'active'
                """,
                (source, str(external_id)),
            )
            return cur.fetchone()

    def subscriptions(self, conn: psycopg.Connection) -> list[dict[str, Any]]:
        with conn.cursor() as cur:
            cur.execute(
                """
                select s.id as sub_id, s.user_id, s.criteria, s.name,
                       u.tg_id, u.digest, u.notify_new, u.lang
                from subscription s
                join app_user u on u.id = s.user_id
                where s.active and u.notify_new
                """
            )
            return cur.fetchall()

    def remember(
        self, conn: psycopg.Connection, user_id: int, listing_id: int, status: str = "pending"
    ) -> bool:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into notification (user_id, listing_id, status)
                values (%s, %s, %s)
                on conflict (user_id, listing_id) do nothing
                returning id
                """,
                (user_id, listing_id, status),
            )
            inserted = cur.fetchone()
        conn.commit()
        return bool(inserted)

    # -- отправка -------------------------------------------------------
    def _throttle(self, chat_id: int) -> None:
        now = time.monotonic()
        wait = max(self._last_global + 1 / 25 - now, self._last_chat.get(chat_id, 0) + 1.05 - now)
        if wait > 0:
            time.sleep(wait)
        self._last_global = time.monotonic()
        self._last_chat[chat_id] = self._last_global

    def send(
        self, chat_id: int, item: dict[str, Any], lang: str | None = "ru"
    ) -> tuple[bool, int | None, str | None]:
        self._throttle(chat_id)
        url = f"{self.public_url}/listing/{item['id']}"
        text = msg(lang)
        caption = grid_caption(item, lang)
        keyboard = {
            "inline_keyboard": [
                [{"text": text["open_app"], "web_app": {"url": url}}],
                [{"text": text["my_filters"], "web_app": {"url": f"{self.public_url}/account"}}],
            ]
        }
        # Фото-сообщение: ссылки в тексте нет, переход только по кнопке.
        photo = item.get("thumb_url")
        if photo:
            response = self.client.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendPhoto",
                json={
                    "chat_id": chat_id,
                    "photo": photo,
                    "caption": caption,
                    "parse_mode": "HTML",
                    "reply_markup": keyboard,
                },
            )
            data = response.json()
        else:
            data = {"ok": False}
        if not data.get("ok"):
            response = self.client.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": caption,
                    "parse_mode": "HTML",
                    "reply_markup": keyboard,
                },
            )
            data = response.json()
        if not data.get("ok"):
            log.warning("Telegram отказал: %s", data.get("description"))
            return False, None, str(data.get("description") or "telegram error")[:500]
        message_id = (data.get("result") or {}).get("message_id")
        return True, int(message_id) if message_id else None, None

    # -- фиксация результата --------------------------------------------
    def sent_last_hour(self, conn: psycopg.Connection, user_id: int) -> int:
        with conn.cursor() as cur:
            cur.execute(
                "select count(*) from notification where user_id = %s "
                "and status = 'sent' and sent_at > now() - interval '1 hour'",
                (user_id,),
            )
            return int(cur.fetchone()[0])

    def hold(self, conn: psycopg.Connection, user_id: int, listing_id: int) -> None:
        with conn.cursor() as cur:
            cur.execute(
                "update notification set status = 'held' "
                "where user_id = %s and listing_id = %s",
                (user_id, listing_id),
            )
        conn.commit()

    def mark_sent(
        self,
        conn: psycopg.Connection,
        user_id: int,
        listing_id: int,
        message_id: int | None,
    ) -> None:
        with conn.cursor() as cur:
            cur.execute(
                """
                update notification
                   set status = 'sent', sent_at = now(), attempts = attempts + 1,
                       telegram_message_id = %s, last_error = null
                 where user_id = %s and listing_id = %s
                """,
                (message_id, user_id, listing_id),
            )
        conn.commit()

    def mark_failed(
        self,
        conn: psycopg.Connection,
        user_id: int,
        listing_id: int,
        attempts: int,
        error: str,
    ) -> None:
        next_status = "dead" if attempts + 1 >= MAX_ATTEMPTS else "failed"
        delay = retry_delay(attempts + 1)
        with conn.cursor() as cur:
            cur.execute(
                """
                update notification
                   set status = %s, attempts = attempts + 1, last_error = %s,
                       next_attempt_at = now() + make_interval(secs => %s)
                 where user_id = %s and listing_id = %s
                """,
                (next_status, error[:500], delay, user_id, listing_id),
            )
        conn.commit()

    def retry_due(self, limit: int = 50) -> int:
        """Досылает всё, что не ушло: упало, не дошло, потерялось при рестарте."""
        conn = self.connect()
        sent = 0
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select n.id, n.user_id, n.listing_id, n.attempts,
                           u.tg_id, u.lang,
                           l.title, l.price, l.currency, l.year, l.mileage_km,
                           l.city, l.thumb_url, l.url
                    from notification n
                    join app_user u on u.id = n.user_id
                    join listing l on l.id = n.listing_id
                    where n.status in ('pending', 'failed')
                      and n.next_attempt_at <= now()
                      and u.notify_new and not u.digest
                    order by n.next_attempt_at
                    limit %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
            for row in rows:
                item = dict(row)
                item["id"] = row["listing_id"]
                try:
                    ok, message_id, error = self.send(row["tg_id"], item, row.get("lang"))
                except Exception as exc:  # noqa: BLE001
                    ok, message_id, error = False, None, str(exc)
                if ok:
                    self.mark_sent(conn, row["user_id"], row["listing_id"], message_id)
                    sent += 1
                else:
                    self.mark_failed(
                        conn, row["user_id"], row["listing_id"], row["attempts"], error or ""
                    )
            return sent
        finally:
            conn.close()

    def send_digests(self, min_age_minutes: int = 60, limit_users: int = 50) -> int:
        """Собирает held-уведомления в одно сообщение на пользователя."""
        conn = self.connect()
        sent = 0
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select u.id, u.tg_id, u.lang, count(*) as total
                    from notification n join app_user u on u.id = n.user_id
                    where n.status = 'held'
                      and n.created_at < now() - make_interval(mins => %s)
                    group by u.id, u.tg_id, u.lang
                    limit %s
                    """,
                    (min_age_minutes, limit_users),
                )
                users = cur.fetchall()
            for user in users:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        select l.id, l.title, l.price, l.url
                        from notification n join listing l on l.id = n.listing_id
                        where n.user_id = %s and n.status = 'held'
                          and n.created_at < now() - make_interval(mins => %s)
                        order by n.created_at limit 20
                        """,
                        (user["id"], min_age_minutes),
                    )
                    items = cur.fetchall()
                if not items:
                    continue
                text = digest([dict(item) for item in items], user.get("lang"), int(user["total"]))
                keyboard = {
                    "inline_keyboard": [[
                        {
                            "text": msg(user.get("lang"))["open_app"],
                            "web_app": {"url": f"{self.public_url}/list"},
                        }
                    ]]
                }
                response = self.client.post(
                    f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                    json={
                        "chat_id": user["tg_id"],
                        "text": text[:4000],
                        "parse_mode": "HTML",
                        "reply_markup": keyboard,
                        "disable_web_page_preview": True,
                    },
                )
                data = response.json()
                if not data.get("ok"):
                    log.warning("дайджест не ушёл: %s", data.get("description"))
                    continue
                message_id = (data.get("result") or {}).get("message_id")
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        update notification set status = 'sent', sent_at = now(),
                               attempts = attempts + 1, telegram_message_id = %s
                        where user_id = %s and status = 'held'
                          and created_at < now() - make_interval(mins => %s)
                        """,
                        (message_id, user["id"], min_age_minutes),
                    )
                conn.commit()
                sent += 1
            return sent
        finally:
            conn.close()

    def health(self) -> dict[str, Any]:
        conn = self.connect()
        try:
            with conn.cursor() as cur:
                cur.execute("select count(*) from notification where status = 'dead'")
                dead = int(cur.fetchone()[0])
                cur.execute(
                    "select extract(epoch from (now() - max(heartbeat_at))) / 60 "
                    "from collector where heartbeat_at is not null"
                )
                row = cur.fetchone()
                idle = int(row[0]) if row and row[0] is not None else None
            return {"dead": dead, "collector_idle_min": idle}
        finally:
            conn.close()

    def alert(self, text: str, admin_chat: int) -> bool:
        response = self.client.post(
            f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
            json={"chat_id": admin_chat, "text": text[:4000], "parse_mode": "HTML"},
        )
        return bool(response.json().get("ok"))

    # -- обработка события ----------------------------------------------
    def handle_event(self, event: dict[str, Any]) -> int:
        if event.get("type") != "listing.created":
            return 0
        conn = self.connect()
        try:
            item = self.listing(conn, event.get("source", "otomoto"), event["external_id"])
            if not item:
                return 0
            sent = 0
            for sub in self.subscriptions(conn):
                if not matches(sub["criteria"] or {}, item):
                    continue
                status = "held" if sub["digest"] else "pending"
                if not self.remember(conn, sub["user_id"], item["id"], status):
                    continue
                if sub["digest"]:
                    continue  # уйдёт в дайджесте
                if self.sent_last_hour(conn, sub["user_id"]) >= HOURLY_CAP:
                    # Не заваливаем человека: остаток уйдёт дайджестом.
                    self.hold(conn, sub["user_id"], item["id"])
                    continue
                try:
                    ok, message_id, error = self.send(sub["tg_id"], item, sub.get("lang"))
                except Exception as exc:  # noqa: BLE001
                    ok, message_id, error = False, None, str(exc)
                if ok:
                    self.mark_sent(conn, sub["user_id"], item["id"], message_id)
                    sent += 1
                else:
                    self.mark_failed(conn, sub["user_id"], item["id"], 0, error or "send failed")
            return sent
        finally:
            conn.close()
