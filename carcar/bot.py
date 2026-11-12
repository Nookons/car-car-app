"""Telegram-бот CarCar: точка входа в Mini App.

Никакой бизнес-логики в боте нет — он открывает приложение. Это осознанно:
поиск, фильтры и уведомления живут в Mini App, а бот остаётся тонким.

Запуск: `python -m carcar bot --public-url https://...`
"""

from __future__ import annotations

import contextlib
import html
import logging
import re
import time

import httpx

from .messages import DRIVE_LABELS, FUEL_LABELS, GEARBOX_LABELS, SPEC_LABELS
from .messages import messages as msg

log = logging.getLogger("carcar.bot")




class Bot:
    def __init__(self, token: str, public_url: str | None = None) -> None:
        self.token = token
        self.public_url = (public_url or "").rstrip("/") or None
        self.client = httpx.Client(
            base_url=f"https://api.telegram.org/bot{token}",
            timeout=httpx.Timeout(40.0, connect=10.0),
        )
        self.offset = 0

    # -- API ---------------------------------------------------------------
    def call(self, method: str, **params) -> dict:
        response = self.client.post(method, json=params)
        data = response.json()
        if not data.get("ok"):
            raise RuntimeError(f"{method}: {data.get('description')}")
        return data["result"]

    def me(self) -> dict:
        return self.call("getMe")

    def set_webhook(self, url: str, secret: str | None = None) -> dict:
        params: dict = {
            "url": url,
            "allowed_updates": ["message", "callback_query", "inline_query"],
        }
        if secret:
            params["secret_token"] = secret
        return self.call("setWebhook", **params)

    def configure(self) -> None:
        """Команды и кнопка меню — только если есть публичный https-адрес."""
        self.call(
            "setMyCommands",
            commands=[{"command": "start", "description": "Открыть CarCar"}],
        )
        if not self.public_url:
            log.warning("CARCAR_PUBLIC_URL не задан: кнопка меню не настроена")
            return

        menu = {
            "type": "web_app",
            "text": "Открыть CarCar",
            "web_app": {"url": self.public_url},
        }
        self.call("setChatMenuButton", menu_button=menu)

        # У старых чатов могла остаться своя кнопка на /en/car — переписываем.
        for tg_id in self.known_chat_ids():
            try:
                localized = {
                    "type": "web_app",
                    "text": msg(self.lang_for(tg_id))["menu_button"],
                    "web_app": {"url": self.public_url},
                }
                self.call("setChatMenuButton", chat_id=tg_id, menu_button=localized)
            except Exception as exc:  # noqa: BLE001
                log.warning("меню для чата %s: %s", tg_id, exc)

    def known_chat_ids(self) -> list[int]:
        try:
            from .db import database_url

            url = database_url()
            if not url:
                return []
            import psycopg

            with psycopg.connect(url, connect_timeout=10) as conn:
                rows = conn.execute(
                    "select tg_id from app_user where tg_id > 1000 order by id"
                ).fetchall()
            return [int(row[0]) for row in rows]
        except Exception as exc:  # noqa: BLE001
            log.warning("не смог прочитать пользователей: %s", exc)
            return []

    # -- обработка ---------------------------------------------------------
    def specs_text(self, listing_id: int, lang: str) -> str | None:
        labels = SPEC_LABELS.get(lang, SPEC_LABELS["ru"])
        try:
            from .db import database_url

            url = database_url()
            if not url:
                return None
            import psycopg

            with psycopg.connect(url, connect_timeout=10, prepare_threshold=None) as conn:
                row = conn.execute(
                    """
                    select title, price, url, year, mileage_km, engine_cm3, power_hp,
                           fuel, gearbox, body, drive, color, doors, seats, condition,
                           co2_gkm, consumption_urban, consumption_extra, city, seller_name
                    from listing where id = %s
                    """,
                    (listing_id,),
                ).fetchone()
        except Exception:  # noqa: BLE001
            return None
        if not row:
            return None

        fuel = FUEL_LABELS.get(lang, {}).get(row[7] or "", row[7] or "")
        gearbox = GEARBOX_LABELS.get(lang, {}).get(row[8] or "", row[8] or "")
        drive = DRIVE_LABELS.get(lang, {}).get(row[10] or "", row[10] or "")
        miles = f"{row[4]:,}".replace(",", " ") if row[4] else ""
        price = f"{row[1]:,}".replace(",", " ") if row[1] else ""
        rows = [
            (labels["year"], row[3]),
            (labels["mileage"], miles),
            (labels["engine"], f"{row[5]} cm³" if row[5] else ""),
            (labels["power"], f"{row[6]} KM" if row[6] else ""),
            (labels["fuel"], fuel),
            (labels["gearbox"], gearbox),
            (labels["body"], row[9]),
            (labels["drive"], drive),
            (labels["color"], row[11]),
            (labels["doors"], row[12]),
            (labels["seats"], row[13]),
            (labels["condition"], row[14]),
            (labels["co2"], f"{row[15]} g/km" if row[15] else ""),
            (labels["urban"], f"{row[16]} l/100" if row[16] else ""),
            (labels["extra"], f"{row[17]} l/100" if row[17] else ""),
            (labels["city"], row[18]),
            (labels["seller"], row[19]),
        ]
        table = "\n".join(f"{label:<20}{value}" for label, value in rows if value)
        title = str(row[0]).replace("<", "&lt;").replace(">", "&gt;")
        return (
            f"<b>{title}</b>\n{price} zł\n\n"
            f"<blockquote expandable><pre>{table}</pre></blockquote>"
        )

    def inline_results(self, query: str, limit: int = 5) -> list[dict]:
        """Результаты для @bot <запрос>: статья с ценой и ссылкой на share-карточку."""
        query = (query or "").strip()[:80]
        if not query:
            return []
        terms = [part for part in query.split() if part][:5]
        if not terms:
            return []
        conds, params = [], []
        for part in terms:
            term = part.replace("!", "!!").replace("%", "!%").replace("_", "!_")
            pattern = f"%{term}%"
            conds.append(
                "(title ilike %s escape '!' or make ilike %s escape '!' "
                "or model ilike %s escape '!')"
            )
            params.extend([pattern, pattern, pattern])
        where = " and ".join(conds)
        try:
            from .db import database_url

            url = database_url()
            if not url:
                return []
            import psycopg
            from psycopg.rows import dict_row

            with psycopg.connect(
                url,
                connect_timeout=10,
                prepare_threshold=None,
                row_factory=dict_row,
            ) as conn:
                rows = conn.execute(
                    f"""
                    select id, title, price, currency, year, mileage_km, city,
                           thumb_url, url
                    from listing
                    where status = 'active' and {where}
                    order by published_at desc nulls last
                    limit %s
                    """,
                    (*params, max(1, min(limit, 10))),
                ).fetchall()
        except Exception as exc:  # noqa: BLE001
            log.warning("inline-поиск не удался: %s", exc)
            return []

        results = []
        for row in rows:
            title = html.escape(str(row["title"]))
            price_label = f"{int(row['price']):,}".replace(",", " ") if row["price"] else ""
            description = " · ".join(
                str(part)
                for part in (
                    f"{price_label} zł" if price_label else None,
                    row["year"],
                    f"{int(row['mileage_km']):,}".replace(",", " ") + " km"
                    if row["mileage_km"]
                    else None,
                    html.escape(str(row["city"])) if row["city"] else None,
                )
                if part
            )
            card_url = (
                f"{self.public_url}/share/{row['id']}"
                if self.public_url
                else str(row["url"])
            )
            caption = f"<b>{title}</b>\n{description or price_label}"
            result = {
                "type": "article",
                "id": str(row["id"]),
                "title": f"{title} — {price_label} zł" if price_label else title,
                "description": description,
                "input_message_content": {
                    "message_text": f"{caption}\n{card_url}",
                    "parse_mode": "HTML",
                },
            }
            thumb = str(row["thumb_url"] or "").split("?")[0].lower()
            if row["thumb_url"] and thumb.endswith((".jpg", ".jpeg", ".png")):
                result["thumb_url"] = row["thumb_url"]
            if self.public_url:
                result["reply_markup"] = {
                    "inline_keyboard": [[{"text": "Открыть в CarCar", "url": card_url}]]
                }
            results.append(result)
        return results

    def answer_inline(self, inline_query_id: str, query: str) -> None:
        results = self.inline_results(query)
        self.call(
            "answerInlineQuery",
            inline_query_id=inline_query_id,
            results=results,
            cache_time=30,
            is_personal=False,
        )

    def send_specs(self, chat_id: int, listing_id: int) -> None:
        lang = self.lang_for(chat_id)
        text = self.specs_text(listing_id, lang)
        if not text:
            self.call("sendMessage", chat_id=chat_id, text="Не нашёл характеристики")
            return
        keyboard = {
            "inline_keyboard": [[
                {
                    "text": msg(lang)["open_app"],
                    "web_app": {"url": f"{self.public_url}/listing/{listing_id}"},
                }
            ]]
        }
        try:
            self.call(
                "sendMessage",
                chat_id=chat_id,
                text=text,
                parse_mode="HTML",
                reply_markup=keyboard,
                disable_web_page_preview=True,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("specs HTML не принят (%s), отправляю текстом", exc)
            plain = re.sub(r"<[^>]+>", "", text)
            self.call("sendMessage", chat_id=chat_id, text=plain, reply_markup=keyboard)

    def answer_callback(self, callback_id: str) -> None:
        with contextlib.suppress(Exception):
            self.call("answerCallbackQuery", callback_query_id=callback_id)

    def lang_for(self, tg_id: int) -> str:
        try:
            from .db import database_url

            url = database_url()
            if not url:
                return "ru"
            import psycopg

            with psycopg.connect(url, connect_timeout=10, prepare_threshold=None) as conn:
                row = conn.execute(
                    "select lang from app_user where tg_id = %s", (tg_id,)
                ).fetchone()
            return (row[0] if row and row[0] else "ru") or "ru"
        except Exception:  # noqa: BLE001
            return "ru"

    def reply_start(self, chat_id: int) -> None:
        text = msg(self.lang_for(chat_id))
        if self.public_url:
            keyboard = {
                "inline_keyboard": [
                    [{"text": text["start_button"], "web_app": {"url": self.public_url}}],
                    [{"text": "Найти в чате", "switch_inline_query": ""}],
                ]
            }
            self.call("sendMessage", chat_id=chat_id, text=text["start"], reply_markup=keyboard)
        else:
            self.call("sendMessage", chat_id=chat_id, text=text["no_url"])

    def handle_update(self, update: dict) -> None:
        inline = update.get("inline_query")
        if inline:
            with contextlib.suppress(Exception):
                self.answer_inline(inline.get("id", ""), inline.get("query", ""))
            return
        message = update.get("message") or update.get("edited_message")
        if not message:
            return
        text = (message.get("text") or "").strip()
        chat_id = message["chat"]["id"]
        if text.startswith("/start"):
            self.reply_start(chat_id)

    def run(self, *, once: bool = False) -> None:
        me = self.me()
        log.info("бот @%s запущен", me.get("username"))
        self.configure()

        while True:
            try:
                updates = self.call(
                    "getUpdates",
                    offset=self.offset,
                    timeout=30,
                    allowed_updates=["message", "callback_query", "inline_query"],
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("getUpdates: %s", exc)
                time.sleep(3)
                continue

            for update in updates:
                self.offset = max(self.offset, update["update_id"] + 1)
                try:
                    self.handle_update(update)
                except Exception as exc:  # noqa: BLE001
                    log.exception("ошибка обработки update: %s", exc)

            if once:
                return
