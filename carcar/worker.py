"""Воркер уведомлений: слушает шину и рассылает подходящие объявления."""

from __future__ import annotations

import logging
import os
import sys
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

    if minutes:
        deadline = time.monotonic() + minutes * 60
        try:
            bus.consume(handler, consumer)
        except KeyboardInterrupt:
            return 0
        if time.monotonic() > deadline:
            return 0
    bus.consume(handler, consumer)
    return 0
