"""Кеш поверх Redis с деградацией в память процесса.

Redis нужен, чтобы дашборд и API не ходили в Postgres на каждый скролл.
Если REDIS_URL не задан (локальная разработка) — работает простой TTL-кеш.
"""

from __future__ import annotations

import json
import os
import time
from threading import Lock
from typing import Any

try:  # redis не обязателен для локального запуска
    import redis as redis_lib
except Exception:  # noqa: BLE001
    redis_lib = None  # type: ignore[assignment]


class Cache:
    def __init__(self, url: str | None = None, prefix: str = "carcar") -> None:
        self.prefix = prefix
        self._local: dict[str, tuple[float, str]] = {}
        self._redis = None
        self._add_lock = Lock()
        url = url or os.environ.get("REDIS_URL")
        if url and redis_lib is not None:
            try:
                client = redis_lib.from_url(url, decode_responses=True, socket_timeout=2)
                client.ping()
                self._redis = client
            except Exception:  # noqa: BLE001
                self._redis = None

    @property
    def enabled(self) -> bool:
        return self._redis is not None

    def _key(self, key: str) -> str:
        return f"{self.prefix}:{key}"

    def get(self, key: str) -> Any | None:
        full = self._key(key)
        if self._redis is not None:
            try:
                raw = self._redis.get(full)
                return json.loads(raw) if raw else None
            except Exception:  # noqa: BLE001
                return None
        entry = self._local.get(full)
        if not entry:
            return None
        expires, raw = entry
        if expires < time.monotonic():
            self._local.pop(full, None)
            return None
        return json.loads(raw)

    def set(self, key: str, value: Any, ttl: float = 60) -> None:
        raw = json.dumps(value, ensure_ascii=False, default=str)
        if self._redis is not None:
            try:
                self._redis.set(self._key(key), raw, ex=max(1, int(ttl)))
                return
            except Exception:  # noqa: BLE001
                pass
        if len(self._local) > 500:  # простая защита от роста
            self._local.clear()
        self._local[self._key(key)] = (time.monotonic() + ttl, raw)

    def add(self, key: str, value: Any, ttl: float = 60) -> bool:
        """Claim a short-lived operation once, including across API replicas."""
        raw = json.dumps(value, ensure_ascii=False, default=str)
        if self._redis is not None:
            try:
                return bool(self._redis.set(self._key(key), raw, nx=True, ex=max(1, int(ttl))))
            except Exception:  # Redis outage: fall back to a process-local guard.
                pass
        with self._add_lock:
            full = self._key(key)
            now = time.monotonic()
            if self._local.get(full, (0, ""))[0] > now:
                return False
            if len(self._local) > 500:
                self._local = {k: v for k, v in self._local.items() if v[0] > now}
            self._local[full] = (now + ttl, raw)
            return True

    def invalidate(self, prefix: str) -> None:
        if self._redis is not None:
            try:
                for key in self._redis.scan_iter(match=self._key(f"{prefix}*")):
                    self._redis.delete(key)
            except Exception:  # noqa: BLE001
                pass
        self._local = {k: v for k, v in self._local.items() if not k.startswith(self._key(prefix))}
