"""Сценарии сбора: discovery (выдача), detail (карточка), watch (цикл)."""

from __future__ import annotations

import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .client import Client, FetchError
from .config import Settings
from .parse import Listing, ParseError, parse_offer, parse_search
from .store import Store

log = logging.getLogger("carcar")


def utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass
class RunStats:
    started_at: datetime = field(default_factory=utcnow)
    pages: int = 0
    items: int = 0
    new_ids: int = 0
    details_saved: int = 0
    details_skipped: int = 0
    errors: int = 0
    stopped_by_known: bool = False
    seconds: float = 0.0

    def as_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["started_at"] = self.started_at.isoformat()
        return data


@dataclass
class DiscoverResult:
    items: list[Listing]
    stats: RunStats


def discover(
    client: Client,
    store: Store,
    settings: Settings,
    *,
    pages: int = 1,
    stop_after_known: int = 2,
    fetched_at: datetime | None = None,
) -> DiscoverResult:
    """Читает первые страницы выдачи и складывает новые строки в папку.

    Сортировка площадки не строгая: в выдачу подмешиваются «поднятые»
    объявления со старой датой. Поэтому останавливаемся не по дате, а по
    доле уже известных id: две страницы подряд, где >90% мы видели, — стоп.
    """
    started = time.monotonic()
    seen = store.load_seen()
    stats = RunStats()
    found: list[Listing] = []
    known_streak = 0

    for page in range(1, pages + 1):
        url = settings.search_url(page)
        response = client.get(url)
        parsed = parse_search(response.text, url)
        stats.pages += 1
        stats.items += len(parsed.items)

        fresh = [item for item in parsed.items if item.id not in seen]
        known_ratio = 1 - len(fresh) / max(len(parsed.items), 1)
        known_streak = known_streak + 1 if known_ratio > 0.9 else 0

        if fresh:
            store.append_discovered(
                [item.to_row() for item in fresh], fetched_at=fetched_at
            )
            store.add_seen([item.id for item in fresh])
            found.extend(fresh)
        stats.new_ids += len(fresh)

        print(
            f"  стр. {page}: {len(parsed.items):2} объявл. | новых {len(fresh):2} | "
            f"{response.elapsed:4.1f} с | {response.wire_bytes / 1024:6.0f} КБ"
        )

        if stats.new_ids == 0 and page == 1 and parsed.items:
            log.warning("на первой странице нет новых id — возможна смена выдачи")

        if known_streak >= stop_after_known:
            stats.stopped_by_known = True
            log.info("остановка: %d страниц подряд без новых", known_streak)
            break

    stats.seconds = round(time.monotonic() - started, 2)
    return DiscoverResult(items=found, stats=stats)


def fetch_detail(
    client: Client,
    store: Store,
    listing: Listing,
    *,
    fetched_at: datetime | None = None,
    refresh: bool = False,
) -> Path | None:
    """Забирает карточку объявления и сохраняет её. None — если уже сохранена."""
    response = client.get(listing.url)
    offer = parse_offer(response.text, listing.url)
    return store.save_detail(
        offer.raw,
        listing_id=offer.id or listing.id,
        url=listing.url,
        fetched_at=fetched_at,
        refresh=refresh,
    )


def collect(
    client: Client,
    store: Store,
    settings: Settings,
    *,
    pages: int = 1,
    details: int = 5,
    stop_after_known: int = 2,
) -> dict[str, Any]:
    """Выдача + карточки для новых объявлений. Основная команда «собрать»."""
    started = time.monotonic()
    result = discover(
        client, store, settings, pages=pages, stop_after_known=stop_after_known
    )
    stats = result.stats

    for item in result.items[:details]:
        try:
            saved = fetch_detail(client, store, item)
        except (FetchError, ParseError) as exc:
            stats.errors += 1
            log.warning("карточка %s не сохранена: %s", item.id, exc)
            continue
        if saved:
            stats.details_saved += 1
        else:
            stats.details_skipped += 1

    stats.seconds = round(time.monotonic() - started, 2)
    summary = {
        **stats.as_dict(),
        "mode": "collect",
        "settings": {
            "rps": settings.rps,
            "pages": pages,
            "details": details,
        },
        "client": client.stats.as_dict(),
    }
    store.write_run(summary)
    return summary


def watch(
    client: Client,
    store: Store,
    settings: Settings,
    *,
    interval: float = 15.0,
    minutes: float = 90.0,
    details: int = 10,
) -> dict[str, Any]:
    """Цикл «как в проде»: опрос выдачи каждые N секунд + карточки новинок."""
    started = time.monotonic()
    deadline = started + minutes * 60
    total = RunStats()
    rounds = 0

    while time.monotonic() < deadline:
        round_started = time.monotonic()
        rounds += 1
        print(f"[{datetime.now().strftime('%H:%M:%S')}] опрос #{rounds}")
        try:
            result = discover(client, store, settings, pages=1, stop_after_known=1)
        except (FetchError, ParseError) as exc:
            total.errors += 1
            log.error("опрос не удался: %s", exc)
            time.sleep(interval)
            continue

        total.pages += result.stats.pages
        total.items += result.stats.items
        total.new_ids += result.stats.new_ids
        total.errors += result.stats.errors

        for item in result.items[:details]:
            try:
                if fetch_detail(client, store, item):
                    total.details_saved += 1
                else:
                    total.details_skipped += 1
            except (FetchError, ParseError) as exc:
                total.errors += 1
                log.warning("карточка %s: %s", item.id, exc)

        spent = time.monotonic() - round_started
        time.sleep(max(0.0, interval - spent))

    total.seconds = round(time.monotonic() - started, 2)
    summary = {
        **total.as_dict(),
        "mode": "watch",
        "rounds": rounds,
        "interval": interval,
        "client": client.stats.as_dict(),
        "storage": store.stats(),
    }
    store.write_run(summary)
    return summary
