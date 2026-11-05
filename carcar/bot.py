"""Telegram-бот CarCar: точка входа в Mini App.

Никакой бизнес-логики в боте нет — он открывает приложение. Это осознанно:
поиск, фильтры и уведомления живут в Mini App, а бот остаётся тонким.

Запуск: `python -m carcar bot --public-url https://...`
"""

from __future__ import annotations

import logging
import time

import httpx

log = logging.getLogger("carcar.bot")

TEXT_START = (
    "CarCar — свежие объявления о продаже авто в Польше.\n\n"
    "Открой приложение: поиск, фильтры по расстоянию и уведомления."
)

TEXT_NO_URL = (
    "Бот настроен, но публичный адрес приложения ещё не задан.\n"
    "Задай CARCAR_PUBLIC_URL (https://…) и перезапусти бота."
)


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

    def configure(self) -> None:
        """Команды и кнопка меню — только если есть публичный https-адрес."""
        self.call(
            "setMyCommands",
            commands=[{"command": "start", "description": "Открыть CarCar"}],
        )
        if not self.public_url:
            log.warning("CARCAR_PUBLIC_URL не задан: кнопка меню не настроена")
            return
        self.call(
            "setChatMenuButton",
            menu_button={
                "type": "web_app",
                "text": "Открыть CarCar",
                "web_app": {"url": self.public_url},
            },
        )

    # -- обработка ---------------------------------------------------------
    def reply_start(self, chat_id: int) -> None:
        if self.public_url:
            keyboard = {
                "inline_keyboard": [[
                    {"text": "🚗 Открыть CarCar", "web_app": {"url": self.public_url}}
                ]]
            }
            self.call(
                "sendMessage",
                chat_id=chat_id,
                text=TEXT_START,
                reply_markup=keyboard,
            )
        else:
            self.call("sendMessage", chat_id=chat_id, text=TEXT_NO_URL)

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
