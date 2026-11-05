"""Telegram-бот CarCar: точка входа в Mini App.

Никакой бизнес-логики в боте нет — он открывает приложение. Это осознанно:
поиск, фильтры и уведомления живут в Mini App, а бот остаётся тонким.

Запуск: `python -m carcar bot --public-url https://...`
"""

from __future__ import annotations

import logging
import time

import httpx

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
        params: dict = {"url": url, "allowed_updates": ["message"]}
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
                "inline_keyboard": [[
                    {"text": text["start_button"], "web_app": {"url": self.public_url}}
                ]]
            }
            self.call("sendMessage", chat_id=chat_id, text=text["start"], reply_markup=keyboard)
        else:
            self.call("sendMessage", chat_id=chat_id, text=text["no_url"])

    def handle_update(self, update: dict) -> None:
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
                    "getUpdates", offset=self.offset, timeout=30, allowed_updates=["message"]
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
