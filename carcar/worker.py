"""Воркер уведомлений: слушает шину и рассылает подходящие объявления."""

from __future__ import annotations

import logging
import os
import sys
import threading
import time

from .bus import make_bus
from .db import database_url
from .notify import Notifier

log = logging.getLogger("carcar.worker")


def run(consumer: str = "worker-1", minutes: float | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    dsn = database_url()
    token = os.environ.get("CARCAR_BOT_TOKEN", "")
    if not dsn or not token:
        print("нужны DATABASE_URL и CARCAR_BOT_TOKEN", file=sys.stderr)
        return 2

    notifier = Notifier(
        dsn,
        token,
        os.environ.get("CARCAR_PUBLIC_URL", "https://car-car-app.vercel.app"),
    )
    bus = make_bus()
    log.info("воркер %s слушает шину (%s)", consumer, type(bus).__name__)

    def handler(event: dict) -> None:
        log.info("событие: %s", event)
        try:
            sent = notifier.handle_event(event)
            if sent:
                log.info("событие %s → отправлено %s", event.get("external_id"), sent)
        except Exception:  # noqa: BLE001
            log.exception("ошибка обработки события")

    # Слушаем шину в фоне, а в основном цикле добиваем недоставленное из БД.
    threading.Thread(target=bus.consume, args=(handler, consumer), daemon=True).start()

    admin_chat = int(os.environ.get("CARCAR_ADMIN_CHAT_ID", "0") or 0)
    deadline = time.monotonic() + minutes * 60 if minutes else None
    last_alert: str | None = None
    tick = 0

    while True:
        tick += 1
        try:
            sent = notifier.retry_due(50)
            if sent:
                log.info("повторная доставка: %s", sent)
        except Exception:  # noqa: BLE001
            log.exception("ошибка ретраев")

        try:
            delivered = notifier.send_digests(min_age_minutes=60)
            if delivered:
                log.info("дайджест отправлен: %s", delivered)
        except Exception:  # noqa: BLE001
            log.exception("ошибка дайджеста")

        if admin_chat and tick % 15 == 0:  # раз в ~5 минут
            try:
                state = notifier.health()
                problems = []
                if state["dead"]:
                    problems.append(f"dead-уведомлений: {state['dead']}")
                idle = state["collector_idle_min"]
                if idle is not None and idle > 20:
                    problems.append(f"сборщик молчит {idle} мин")
                text = "⚠️ CarCar: " + "; ".join(problems) if problems else ""
                if text and text != last_alert:
                    notifier.alert(text, admin_chat)
                    last_alert = text
                    log.warning("алерт админу: %s", text)
                elif not text:
                    last_alert = None
            except Exception:  # noqa: BLE001
                log.exception("ошибка алертов")

        if deadline and time.monotonic() > deadline:
            return 0
        time.sleep(20)
