"""HTTP-клиент сборщика: вежливый темп, ретраи, сжатие, keep-alive.

Почему httpx, а не urllib: keep-alive и brotli.
Замер на otomoto: страница 1.76 МБ без сжатия против 182 КБ в brotli,
а повторное соединение экономит TLS-рукопожатие (~100–200 мс) на каждом
запросе. Для поллинга раз в 15 секунд это заметно.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field

import httpx

from .config import Settings

# Статусы, после которых имеет смысл повторить запрос.
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


class FetchError(RuntimeError):
    """Сеть/сервер не отдали страницу после всех попыток."""


class BlockedError(FetchError):
    """Площадка ответила 403 — нас не пускают. Повторять бессмысленно и вредно."""


@dataclass(slots=True)
class FetchResult:
    url: str
    status: int
    text: str
    elapsed: float  # секунды на последний запрос
    wire_bytes: int  # сколько реально пришло по сети (после сжатия)
    text_bytes: int  # размер распакованного текста


@dataclass
class ClientStats:
    requests: int = 0
    retries: int = 0
    errors: int = 0
    wire_bytes: int = 0
    text_bytes: int = 0
    elapsed: float = 0.0

    def as_dict(self) -> dict[str, float | int]:
        return {
            "requests": self.requests,
            "retries": self.retries,
            "errors": self.errors,
            "wire_bytes": self.wire_bytes,
            "text_bytes": self.text_bytes,
            "elapsed": round(self.elapsed, 3),
        }


@dataclass
class Client:
    settings: Settings
    transport: httpx.BaseTransport | None = None
    stats: ClientStats = field(default_factory=ClientStats)
    _last_request: float = 0.0

    def __post_init__(self) -> None:
        self._client = httpx.Client(
            headers={
                "User-Agent": self.settings.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
            },
            timeout=self.settings.timeout,
            follow_redirects=True,
            transport=self.transport,
            # Держим соединения живыми: каждый новый коннект — это TLS заново.
            limits=httpx.Limits(max_keepalive_connections=4, max_connections=8),
        )
        self._min_interval = 1.0 / max(self.settings.rps, 0.01)

    # -- жизненный цикл ---------------------------------------------------
    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> Client:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- темп -------------------------------------------------------------
    def _wait_for_slot(self) -> None:
        """Держим не больше settings.rps запросов в секунду."""
        wait = self._min_interval - (time.monotonic() - self._last_request)
        if wait > 0:
            time.sleep(wait)
        self._last_request = time.monotonic()

    def _sleep_backoff(
        self, attempt: int, retry_after: float | None = None, *, heavy: bool = False
    ) -> None:
        if retry_after is not None:
            time.sleep(min(retry_after, 60.0))
            return
        base = self.settings.backoff_base * (2 ** (attempt - 1))
        if heavy:  # 429/503 — площадка просит притормозить
            base = max(base, 10.0 * attempt)
        time.sleep(min(base, 60.0) + random.uniform(0, 0.5))

    # -- запрос -----------------------------------------------------------
    def get(self, url: str) -> FetchResult:
        last_error: Exception | None = None

        for attempt in range(1, self.settings.retries + 1):
            self._wait_for_slot()
            started = time.monotonic()
            try:
                response = self._client.get(url)
            except httpx.HTTPError as exc:  # таймаут, обрыв, DNS
                last_error = exc
                self.stats.errors += 1
                if attempt == self.settings.retries:
                    break
                self.stats.retries += 1
                self._sleep_backoff(attempt)
                continue

            elapsed = time.monotonic() - started
            self.stats.requests += 1

            if response.status_code == 403:
                raise BlockedError(
                    f"403 на {url}: площадка блокирует запросы "
                    "(сменился IP/UA или сработал лимит)"
                )

            if response.status_code in RETRY_STATUSES:
                self.stats.errors += 1
                if attempt == self.settings.retries:
                    raise FetchError(
                        f"{response.status_code} на {url} после {attempt} попыток"
                    )
                self.stats.retries += 1
                self._sleep_backoff(
                    attempt,
                    _retry_after(response),
                    heavy=response.status_code in (429, 503),
                )
                continue

            response.raise_for_status()
            text = response.text
            wire = int(getattr(response, "num_bytes_downloaded", 0) or 0)
            self.stats.wire_bytes += wire
            self.stats.text_bytes += len(text)
            self.stats.elapsed += elapsed

            return FetchResult(
                url=str(response.url),
                status=response.status_code,
                text=text,
                elapsed=elapsed,
                wire_bytes=wire,
                text_bytes=len(text),
            )

        raise FetchError(f"не удалось получить {url}: {last_error}")


def _retry_after(response: httpx.Response) -> float | None:
    """Retry-After в секундах (или дате). Возвращаем секунды, если понятно."""
    value = response.headers.get("Retry-After")
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None
