"""Событийная шина: Redis Streams по умолчанию, Kafka при наличии брокера.

Событие — маленький JSON: {"type": "listing.created", "id": 123, "source": "otomoto"}.
Продюсер — сборщик, консьюмер — воркер уведомлений.

Kafka включается переменной KAFKA_BOOTSTRAP=host:9092, иначе используется
REDIS_URL (Redis Streams). Это осознанный выбор: на нашем объёме (сотни
событий в день) Streams проще и дешевле, а Kafka-адаптер лежит рядом на случай
роста до десятков тысяч событий и нескольких консьюмеров.
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import Callable
from typing import Any

log = logging.getLogger("carcar.bus")

TOPIC = "listings"
GROUP = "carcar-notify"


class EventBus:
    def publish(self, event: dict[str, Any]) -> None:
        raise NotImplementedError

    def consume(
        self, handler: Callable[[dict[str, Any]], None], consumer: str = "worker-1"
    ) -> None:
        raise NotImplementedError

    def close(self) -> None:
        pass


class NullBus(EventBus):
    """Без REDIS_URL/KAFKA_BOOTSTRAP: события просто пишутся в лог."""

    def publish(self, event: dict[str, Any]) -> None:
        log.debug("событие без шины: %s", event)

    def consume(
        self, handler: Callable[[dict[str, Any]], None], consumer: str = "worker-1"
    ) -> None:
        log.warning("шина не настроена — воркеру нечего слушать")
        while True:
            time.sleep(30)


class HttpBus(EventBus):
    """Сборщик без прямого доступа к Redis отправляет события через API."""

    def __init__(self, url: str, token: str) -> None:
        self.url = url.rstrip("/") + "/api/ingest/events"
        self.token = token

    def publish(self, event: dict[str, Any]) -> None:
        import httpx

        httpx.post(
            self.url,
            json={"events": [event]},
            headers={"X-Ingest-Token": self.token},
            timeout=15,
        ).raise_for_status()

    def consume(
        self, handler: Callable[[dict[str, Any]], None], consumer: str = "worker-1"
    ) -> None:
        log.warning("HttpBus не умеет читать события")


class RedisStreamBus(EventBus):
    def __init__(self, url: str) -> None:
        import redis as redis_lib

        # socket_timeout должен быть больше block в xreadgroup, иначе каждые 5 с Timeout
        self.client = redis_lib.from_url(
            url, decode_responses=True, socket_timeout=30, socket_connect_timeout=5
        )
        self.stream = f"carcar:{TOPIC}"
        self.group = GROUP
        try:
            self.client.xgroup_create(self.stream, self.group, id="0", mkstream=True)
        except Exception as exc:  # noqa: BLE001
            if "BUSYGROUP" not in str(exc):
                raise

    def publish(self, event: dict[str, Any]) -> None:
        self.client.xadd(
            self.stream, {"payload": json.dumps(event)}, maxlen=100_000, approximate=True
        )

    def consume(
        self, handler: Callable[[dict[str, Any]], None], consumer: str = "worker-1"
    ) -> None:
        while True:
            try:
                response = self.client.xreadgroup(
                    self.group, consumer, {self.stream: ">"}, count=20, block=5000
                )
            except Exception as exc:  # noqa: BLE001
                if "imeout" in type(exc).__name__:
                    continue
                log.warning("Redis Streams: %s", exc)
                time.sleep(2)
                continue
            if not response:
                continue
            for _, entries in response:
                for entry_id, fields in entries:
                    try:
                        handler(json.loads(fields["payload"]))
                        self.client.xack(self.stream, self.group, entry_id)
                    except Exception:  # noqa: BLE001
                        log.exception("событие %s не обработано", entry_id)


class KafkaBus(EventBus):
    def __init__(self, bootstrap: str) -> None:
        from kafka import KafkaProducer

        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap.split(","),
            value_serializer=lambda value: json.dumps(value).encode(),
            acks=1,
            linger_ms=50,
        )
        self.bootstrap = bootstrap

    def publish(self, event: dict[str, Any]) -> None:
        self.producer.send(TOPIC, event)
        self.producer.flush(timeout=5)

    def consume(
        self, handler: Callable[[dict[str, Any]], None], consumer: str = "worker-1"
    ) -> None:
        from kafka import KafkaConsumer

        consumer_client = KafkaConsumer(
            TOPIC,
            bootstrap_servers=self.bootstrap.split(","),
            group_id=GROUP,
            auto_offset_reset="latest",
            enable_auto_commit=True,
            value_deserializer=lambda value: json.loads(value),
        )
        for record in consumer_client:
            try:
                handler(record.value)
            except Exception:  # noqa: BLE001
                log.exception("событие Kafka не обработано")


def make_bus() -> EventBus:
    kafka = os.environ.get("KAFKA_BOOTSTRAP")
    if kafka:
        try:
            return KafkaBus(kafka)
        except Exception as exc:  # noqa: BLE001
            log.warning("Kafka недоступна (%s), падаю на Redis", exc)
    ingest_url = os.environ.get("CARCAR_INGEST_URL")
    ingest_token = os.environ.get("CARCAR_INGEST_TOKEN")
    if ingest_url and ingest_token:
        return HttpBus(ingest_url, ingest_token)
    url = os.environ.get("REDIS_URL")
    if url:
        try:
            return RedisStreamBus(url)
        except Exception as exc:  # noqa: BLE001
            log.warning("Redis недоступен (%s)", exc)
    return NullBus()
