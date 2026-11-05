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

log = logging.getLogger("carcar.notify")


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
                       u.tg_id, u.digest, u.notify_new
                from subscription s
                join app_user u on u.id = s.user_id
                where s.active and u.notify_new
                """
            )
            return cur.fetchall()

    def remember(self, conn: psycopg.Connection, user_id: int, listing_id: int) -> bool:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into notification (user_id, listing_id, status)
                values (%s, %s, 'pending')
                on conflict (user_id, listing_id) do nothing
                returning id
                """,
                (user_id, listing_id),
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

    def send(self, chat_id: int, item: dict[str, Any]) -> bool:
        self._throttle(chat_id)
        url = f"{self.public_url}/listing/{item['id']}"
        price = f"{item['price']:,}".replace(",", " ") if item.get("price") else "цена не указана"
        caption = (
            f"🚗 {item['title']}\n"
            f"💰 {price} zł\n"
            f"📅 {item.get('year') or '—'} · {item.get('mileage_km') or 0:,} км\n"
            f"📍 {item.get('city') or '—'}\n"
            f"✅ Подходит под ваш фильтр"
        ).replace(",", " ")
        keyboard = {
            "inline_keyboard": [
                [{"text": "🚗 Открыть в CarCar", "web_app": {"url": url}}],
                [
                    {"text": "На otomoto", "url": item.get("url") or url},
                    {"text": "Мои фильтры", "web_app": {"url": f"{self.public_url}/account"}},
                ],
            ]
        }
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "caption": caption[:1024],
            "reply_markup": keyboard,
        }
        endpoint = "sendPhoto"
        if item.get("thumb_url"):
            payload["photo"] = item["thumb_url"]
        else:
            endpoint = "sendMessage"
            payload["text"] = payload.pop("caption")

        response = self.client.post(
            f"https://api.telegram.org/bot{self.bot_token}/{endpoint}", json=payload
        )
        if not response.json().get("ok") and endpoint == "sendPhoto":
            payload.pop("photo", None)
            response = self.client.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": caption[:1024], "reply_markup": keyboard},
            )
        ok = bool(response.json().get("ok"))
        if not ok:
            log.warning("Telegram отказал: %s", response.text[:200])
        return ok

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
                if not self.remember(conn, sub["user_id"], item["id"]):
                    continue
                if sub["digest"]:
                    continue  # уйдёт в дайджесте
                try:
                    if self.send(sub["tg_id"], item):
                        with conn.cursor() as cur:
                            cur.execute(
                                "update notification set status = 'sent', sent_at = now() "
                                "where user_id = %s and listing_id = %s",
                                (sub["user_id"], item["id"]),
                            )
                        conn.commit()
                        sent += 1
                except Exception as exc:  # noqa: BLE001
                    log.warning("не отправил %s: %s", sub["tg_id"], exc)
            return sent
        finally:
            conn.close()
