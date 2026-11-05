"""Сценарии сбора: discovery (выдача), detail (карточка), watch (цикл).

Два режима хранения:
  * `sink` (DatabaseSink) — канонические строки уходят в Postgres/Supabase;
  * без sink — локальная папка (офлайн-разработка).
Файловое хранилище в режиме БД используется только для служебного состояния:
heartbeat, журнал опросов, пауза.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .canonical import canon_body
from .client import Client, FetchError, GoneError
from .config import Settings
from .control import load_control, save_control
from .db import DatabaseSink
from .geo import get_geo
from .parse import Listing, ParseError, parse_offer, parse_search, to_int
from .store import Store

log = logging.getLogger("carcar")

# После стольких ошибок подряд сборщик сам ставит паузу, чтобы не долбить площадку.
AUTO_PAUSE_AFTER = 5


def utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass
class RunStats:
    started_at: datetime = field(default_factory=utcnow)
    pages: int = 0
    items: int = 0
    new_ids: int = 0
    updated: int = 0
    unchanged: int = 0
    rejected: int = 0
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
    sink: DatabaseSink | None = None,
) -> DiscoverResult:
    """Читает выдачу и отдаёт новые объявления (в БД или в папку).

    Сортировка площадки не строгая: в выдачу подмешиваются «поднятые»
    объявления со старой датой. Поэтому останавливаемся не по дате, а по
    доле уже известных: две страницы подряд, где >90% мы видели, — стоп.
    """
    started = time.monotonic()
    seen = store.load_seen() if sink is None else set()
    stats = RunStats()
    found: list[Listing] = []
    known_streak = 0

    for page in range(1, pages + 1):
        url = settings.search_url(page)
        response = client.get(url)
        parsed = parse_search(response.text, url)
        _apply_geo(parsed.items)
        stats.pages += 1
        stats.items += len(parsed.items)

        if sink is not None:
            result = sink.upsert(parsed.items, settings.source)
            fresh = result.new_items
            stats.new_ids += result.inserted
            stats.updated += result.updated
            stats.unchanged += result.unchanged
            stats.rejected += result.rejected
            known_ratio = 1 - result.inserted / max(len(parsed.items), 1)
            tail = f" | обновлено {result.updated}" if result.updated else ""
            shown = f"новых {result.inserted:2}{tail}"
        else:
            fresh = [item for item in parsed.items if item.id not in seen]
            known_ratio = 1 - len(fresh) / max(len(parsed.items), 1)
            if fresh:
                store.append_discovered(
                    [item.to_row() for item in fresh], fetched_at=fetched_at
                )
                store.add_seen([item.id for item in fresh])
            stats.new_ids += len(fresh)
            shown = f"новых {len(fresh):2}"

        known_streak = known_streak + 1 if known_ratio > 0.9 else 0
        found.extend(fresh)

        print(
            f"  стр. {page}: {len(parsed.items):2} объявл. | {shown} | "
            f"{response.elapsed:4.1f} с | {response.wire_bytes / 1024:6.0f} КБ"
        )

        if known_streak >= stop_after_known:
            stats.stopped_by_known = True
            log.info("остановка: %d страниц подряд без новых", known_streak)
            break

    stats.seconds = round(time.monotonic() - started, 2)
    return DiscoverResult(items=found, stats=stats)


def _apply_geo(items: list[Listing]) -> None:
    """Город → координаты центра населённого пункта (если ещё нет)."""
    geo = get_geo()
    for item in items:
        if item.lat is not None and item.lon is not None:
            continue
        place = geo.lookup(item.city, item.region)
        if place:
            item.lat, item.lon, item.geo_source = place.lat, place.lon, "city"


def fetch_detail(
    client: Client,
    store: Store,
    listing: Listing,
    *,
    fetched_at: datetime | None = None,
    refresh: bool = False,
    sink: DatabaseSink | None = None,
    code: str = "otomoto",
) -> Path | str | None:
    """Карточка объявления: в БД — фото/VIN/точные координаты, иначе файл."""
    response = client.get(listing.url)
    offer = parse_offer(response.text, listing.url)

    if sink is not None:
        seller_location = (offer.raw.get("seller") or {}).get("location") or {}
        map_info = seller_location.get("map") or {}
        vin = (offer.details.get("vin") or "").strip().upper() or None
        if vin and len(vin) != 17:
            vin = None
        changed = sink.update_detail(
            listing.id,
            photos=offer.photos,
            vin=vin,
            lat=map_info.get("latitude"),
            lon=map_info.get("longitude"),
            seller_name=offer.seller_name or None,
            seller_type=_seller_type(offer.seller_type),
            body=canon_body(offer.details.get("body_type")),
            color=(offer.details.get("color") or "").strip() or None,
            power_hp=to_int(offer.details.get("engine_power")),
            engine_cm3=to_int(offer.details.get("engine_capacity")),
            code=code,
        )
        return "db" if changed else None

    return store.save_detail(
        offer.raw,
        listing_id=offer.id or listing.id,
        url=listing.url,
        fetched_at=fetched_at,
        refresh=refresh,
    )


def sweep(
    client: Client,
    store: Store,
    settings: Settings,
    *,
    sink: DatabaseSink,
    from_page: int = 1,
    max_pages: int = 0,
    minutes: float = 0.0,
) -> dict[str, Any]:
    """Полный обход рынка постранично, с сохранением прогресса.

    Нужен один раз для истории и потом раз в сутки для проверки «снятых»:
    инкрементальный опрос видит только новые объявления.
    """
    state_path = store.state_dir / "sweep.json"
    state: dict[str, Any] = {}
    if state_path.exists():
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            state = {}

    page = from_page if from_page > 1 else int(state.get("next_page", 1))
    started = time.monotonic()
    deadline = started + minutes * 60 if minutes else None
    totals = {"pages": 0, "inserted": 0, "updated": 0, "rejected": 0, "errors": 0}
    consecutive = 0
    total_pages: int | None = state.get("total_pages")

    while True:
        if max_pages and totals["pages"] >= max_pages:
            break
        if deadline and time.monotonic() >= deadline:
            break
        try:
            response = client.get(settings.search_url(page))
            parsed = parse_search(response.text, settings.search_url(page))
            _apply_geo(parsed.items)
            result = sink.upsert(parsed.items, settings.source)
        except Exception as exc:  # noqa: BLE001
            totals["errors"] += 1
            consecutive += 1
            log.exception("sweep: страница %d не удалась: %s", page, exc)
            time.sleep(min(60.0, 5.0 * consecutive))
            if consecutive >= 8:
                save_control(
                    store.control_path,
                    paused=True,
                    reason=f"авто-пауза: sweep, {totals['errors']} ошибок",
                    by="collector",
                )
                break
            continue

        if total_pages is None and parsed.page_size:
            total_pages = -(-parsed.total // parsed.page_size)

        consecutive = 0
        totals["pages"] += 1
        totals["inserted"] += result.inserted
        totals["updated"] += result.updated
        totals["rejected"] += result.rejected

        state = {
            "next_page": page + 1,
            "total_pages": total_pages,
            "inserted": state.get("inserted", 0) + result.inserted,
            "updated": state.get("updated", 0) + result.updated,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        store._atomic_write(state_path, json.dumps(state, ensure_ascii=False))

        if page % 50 == 0:
            elapsed = time.monotonic() - started
            left = (total_pages - page) if total_pages else 0
            eta = (elapsed / max(page - from_page + 1, 1)) * left / 60 if total_pages else 0
            print(
                f"  стр. {page}/{total_pages or '?'} | новых {totals['inserted']} | "
                f"обновлено {totals['updated']} | ошибок {totals['errors']} | "
                f"~{eta:.0f} мин осталось",
                flush=True,
            )

        page += 1

    return {**totals, "next_page": page, "total_pages": total_pages}


def enrich(
    client: Client,
    store: Store,
    settings: Settings,
    *,
    sink: DatabaseSink,
    limit: int = 200,
    minutes: float = 30.0,
) -> dict[str, Any]:
    """Догружает карточки для объявлений, у которых их ещё нет.

    Отдельный воркер: живой опрос не должен ждать обогащения, иначе новые
    объявления копятся без фото.
    """
    started = time.monotonic()
    deadline = started + minutes * 60
    processed = enriched = errors = 0

    while time.monotonic() < deadline and processed < limit:
        batch = sink.pending_details(limit=50)
        if not batch:
            break
        for row in batch:
            if processed >= limit or time.monotonic() >= deadline:
                break
            listing = Listing(
                id=row["external_id"],
                url=row["url"],
                title="",
                created_at="",
                price=0,
                currency="PLN",
                make="",
                model="",
                year=None,
                mileage_km=None,
                fuel="",
                gearbox="",
                engine_cm3=None,
                power_hp=None,
                city="",
                region="",
                seller_type="",
                thumbnail="",
            )
            try:
                if fetch_detail(client, store, listing, sink=sink):
                    enriched += 1
            except GoneError:
                sink.mark_removed(row["external_id"])
                log.info("снято с продажи: %s", row["external_id"])
            except Exception as exc:  # noqa: BLE001
                errors += 1
                log.warning("enrich %s: %s", row["external_id"], exc)
            processed += 1

    return {
        "processed": processed,
        "enriched": enriched,
        "errors": errors,
        "seconds": round(time.monotonic() - started, 1),
    }


def _seller_type(raw: str) -> str | None:
    if raw == "PROFESSIONAL":
        return "dealer"
    if raw == "PRIVATE":
        return "private"
    return None


def collect(
    client: Client,
    store: Store,
    settings: Settings,
    *,
    pages: int = 1,
    details: int = 5,
    stop_after_known: int = 2,
    sink: DatabaseSink | None = None,
) -> dict[str, Any]:
    """Выдача + карточки для новых объявлений."""
    started = time.monotonic()
    result = discover(
        client, store, settings, pages=pages, stop_after_known=stop_after_known, sink=sink
    )
    stats = result.stats

    for item in result.items[:details]:
        try:
            saved = fetch_detail(client, store, item, sink=sink)
        except (FetchError, ParseError) as exc:
            stats.errors += 1
            log.warning("карточка %s не сохранена: %s", item.id, exc)
            continue
        if saved:
            stats.details_saved += 1
        else:
            stats.details_skipped += 1

    stats.seconds = round(time.monotonic() - started, 2)
    if sink is not None:
        sink.log_run(
            code=settings.source,
            started_at=stats.started_at,
            result=_db_result(stats),
            pages=stats.pages,
            items=stats.items,
            errors=stats.errors,
            notes="collect",
        )
    summary = {
        **stats.as_dict(),
        "mode": "collect",
        "storage": "db" if sink else "files",
        "settings": {"rps": settings.rps, "pages": pages, "details": details},
        "client": client.stats.as_dict(),
    }
    store.write_run(summary)
    return summary


def watch(
    client: Client,
    store: Store,
    settings: Settings,
    *,
    interval: float = 60.0,
    minutes: float = 90.0,
    details: int = 10,
    sink: DatabaseSink | None = None,
) -> dict[str, Any]:
    """Цикл «как в проде»: опрос выдачи каждые N секунд + карточки новинок."""
    started = time.monotonic()
    deadline = started + minutes * 60
    total = RunStats()
    rounds = 0
    paused_logged = False
    last_poll_at: str | None = None
    last_new = 0
    zero_streak = 0
    last_wire = 0
    failures = 0

    while time.monotonic() < deadline:
        control = load_control(store.control_path)
        if control.paused:
            if not paused_logged:
                print(f"пауза: {control.reason or 'без причины'}")
                paused_logged = True
            store.write_heartbeat(
                {
                    "status": "paused",
                    "mode": "watch",
                    "round": rounds,
                    "interval": interval,
                    "paused_reason": control.reason,
                    "last_poll_at": last_poll_at,
                    "last_new": last_new,
                    "totals": _totals(total),
                    "client": client.stats.as_dict(),
                    "storage": "db" if sink else "files",
                }
            )
            time.sleep(min(5.0, interval))
            continue

        if paused_logged:
            print("пауза снята — продолжаю")
            paused_logged = False

        round_started = time.monotonic()
        rounds += 1
        print(f"[{datetime.now().strftime('%H:%M:%S')}] опрос #{rounds}")

        try:
            result = discover(
                client, store, settings, pages=2, stop_after_known=2, sink=sink
            )
        except Exception as exc:  # noqa: BLE001 — демон не должен падать из-за одного опроса
            total.errors += 1
            failures += 1
            log.exception("опрос не удался: %s", exc)
            backoff = min(interval * (2 ** failures), 600.0)

            if failures >= AUTO_PAUSE_AFTER:
                save_control(
                    store.control_path,
                    paused=True,
                    reason=f"авто-пауза: {failures} ошибок подряд ({str(exc)[:120]})",
                    by="collector",
                )
                store.write_heartbeat(
                    {
                        "status": "paused",
                        "mode": "watch",
                        "round": rounds,
                        "interval": interval,
                        "paused_reason": "авто-пауза после серии ошибок",
                        "last_error": str(exc),
                        "totals": _totals(total),
                        "client": client.stats.as_dict(),
                        "storage": "db" if sink else "files",
                    }
                )
                log.error("авто-пауза после %d ошибок подряд", failures)
                break

            store.write_heartbeat(
                {
                    "status": "error",
                    "mode": "watch",
                    "round": rounds,
                    "interval": interval,
                    "last_error": str(exc),
                    "last_poll_at": last_poll_at,
                    "next_poll_at": datetime.fromtimestamp(
                        time.time() + backoff, tz=UTC
                    ).isoformat(),
                    "totals": _totals(total),
                    "client": client.stats.as_dict(),
                    "storage": "db" if sink else "files",
                }
            )
            time.sleep(backoff)
            continue

        failures = 0
        total.pages += result.stats.pages
        total.items += result.stats.items
        total.new_ids += result.stats.new_ids
        total.updated += result.stats.updated
        total.unchanged += result.stats.unchanged
        total.rejected += result.stats.rejected
        total.errors += result.stats.errors
        last_new = result.stats.new_ids
        zero_streak = zero_streak + 1 if last_new == 0 else 0
        last_poll_at = datetime.now(UTC).isoformat()
        if zero_streak and zero_streak % 20 == 0:
            log.warning(
                "%d опросов подряд без новых объявлений — проверьте выдачу", zero_streak
            )

        details_round = 0
        for item in result.items[:details]:
            try:
                if fetch_detail(client, store, item, sink=sink):
                    total.details_saved += 1
                    details_round += 1
                else:
                    total.details_skipped += 1
            except Exception as exc:  # noqa: BLE001
                total.errors += 1
                log.warning("карточка %s: %s", item.id, exc)

        if sink is not None:
            try:
                sink.log_run(
                    code=settings.source,
                    started_at=result.stats.started_at,
                    result=_db_result(result.stats),
                    pages=result.stats.pages,
                    items=result.stats.items,
                    errors=result.stats.errors,
                    notes="watch",
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("не записался crawl_run: %s", exc)

        spent = time.monotonic() - round_started
        pause_left = max(0.0, interval - spent)
        next_poll_at = datetime.now(UTC).timestamp() + pause_left
        total.seconds = round(time.monotonic() - started, 2)

        wire_round = client.stats.wire_bytes - last_wire
        last_wire = client.stats.wire_bytes
        store.append_poll(
            {
                "at": last_poll_at,
                "new": last_new,
                "details": details_round,
                "errors": result.stats.errors,
                "seconds": round(spent, 2),
                "items": result.stats.items,
                "wire_bytes": wire_round,
            }
        )
        store.write_heartbeat(
            {
                "status": "running",
                "mode": "watch",
                "round": rounds,
                "interval": interval,
                "last_poll_at": last_poll_at,
                "last_new": last_new,
                "next_poll_at": datetime.fromtimestamp(next_poll_at, tz=UTC).isoformat(),
                "totals": _totals(total),
                "client": client.stats.as_dict(),
                "storage": "db" if sink else "files",
            }
        )
        time.sleep(pause_left)

    total.seconds = round(time.monotonic() - started, 2)
    summary = {
        **total.as_dict(),
        "mode": "watch",
        "rounds": rounds,
        "interval": interval,
        "storage": "db" if sink else "files",
        "client": client.stats.as_dict(),
    }
    store.write_run(summary)
    store.write_heartbeat(
        {
            "status": "paused" if load_control(store.control_path).paused else "idle",
            "mode": "watch",
            "round": rounds,
            "finished_at": datetime.now(UTC).isoformat(),
            "totals": _totals(total),
            "client": client.stats.as_dict(),
            "storage": "db" if sink else "files",
        }
    )
    return summary


def _db_result(stats: RunStats) -> Any:
    from .db import UpsertResult

    return UpsertResult(
        inserted=stats.new_ids,
        updated=stats.updated,
        unchanged=stats.unchanged,
        rejected=stats.rejected,
    )


def _totals(stats: RunStats) -> dict[str, Any]:
    return {
        "polls": stats.pages,
        "items": stats.items,
        "new_ids": stats.new_ids,
        "updated": stats.updated,
        "unchanged": stats.unchanged,
        "rejected": stats.rejected,
        "details_saved": stats.details_saved,
        "errors": stats.errors,
    }
