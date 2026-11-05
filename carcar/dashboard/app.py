"""Дашборд сборщика: статус, пауза и карточки объявлений.

Данные объявлений читаются из Postgres (Supabase) через `DatabaseRepo`.
Файловое хранилище остаётся офлайн-режимом (`--file`) и для служебного
состояния: heartbeat, журнал опросов, пауза.

Если карточка ещё не обогащена (нет фото/VIN), её можно догрузить кнопкой —
дашборд сходит на площадку и запишет фото в базу.
"""

from __future__ import annotations

import json
import re
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..client import BlockedError, Client, FetchError
from ..config import Settings
from ..control import load_control, save_control
from ..db import DatabaseSink, database_url
from ..geo import distance_km, get_geo
from ..parse import Listing, ParseError, html_to_text
from ..runner import fetch_detail
from ..store import Store
from .repo import DatabaseRepo

STATIC = Path(__file__).parent / "static"
STATS_TTL = 10.0
DIGITS_RE = re.compile(r"^\s*(\d[\d\s\u00a0\u202f]*)")


class ControlIn(BaseModel):
    paused: bool
    source: str = Field(default="otomoto", max_length=40)
    reason: str | None = Field(default=None, max_length=200)
    by: str = Field(default="dashboard", max_length=40)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    match = DIGITS_RE.match(str(value))
    if not match:
        return None
    digits = re.sub(r"\D", "", match.group(1))
    return int(digits) if digits else None


def _pick(details: dict[str, str], row: dict[str, Any], key: str) -> Any:
    value = details.get(key)
    return value if value else row.get(key)


def build_card(store: Store, listing_id: str) -> dict[str, Any] | None:
    """Карточка из файлов (офлайн-режим)."""
    row = store.find_listing(listing_id) or {}
    envelope = store.load_detail(listing_id)
    advert = (envelope or {}).get("data") or {}
    if not row and not advert:
        return None

    details = {
        str(item.get("key")): str(item.get("value"))
        for item in advert.get("details") or []
        if item.get("key")
    }
    photos = [
        str(photo.get("url"))
        for photo in ((advert.get("images") or {}).get("photos") or [])
        if photo.get("url")
    ]
    if not photos and row.get("thumbnail"):
        photos = [row["thumbnail"]]

    price = advert.get("price") or {}
    seller = advert.get("seller") or {}
    location = advert.get("location") or {}
    seller_location = seller.get("location") or {}
    city = (
        (location.get("city") or {}).get("name")
        or seller_location.get("city")
        or row.get("city")
        or ""
    )
    region = (
        (location.get("region") or {}).get("name")
        or seller_location.get("region")
        or row.get("region")
        or ""
    )

    map_info = seller_location.get("map") or {}
    lat = map_info.get("latitude")
    lon = map_info.get("longitude")
    geo_source = "advert" if lat is not None and lon is not None else None
    if lat is None or lon is None:
        lat, lon = row.get("lat"), row.get("lon")
        geo_source = row.get("geo_source")
    if lat is None or lon is None:
        place = get_geo().lookup(city, region)
        if place:
            lat, lon, geo_source = place.lat, place.lon, "city"

    return {
        "id": listing_id,
        "url": advert.get("url") or row.get("url"),
        "title": advert.get("title") or row.get("title"),
        "price": _to_int(price.get("value")) or _to_int(row.get("price")),
        "currency": price.get("currency") or row.get("currency") or "PLN",
        "photos": photos,
        "description": html_to_text(advert.get("description")),
        "details": details,
        "row": row,
        "seller": {
            "type": seller.get("type") or row.get("seller_type"),
            "name": seller.get("name") or "",
        },
        "city": city,
        "region": region,
        "created_at": advert.get("createdAt") or row.get("created_at"),
        "updated_at": advert.get("updatedAt"),
        "has_detail": envelope is not None,
        "fetched_at": (envelope or {}).get("fetched_at"),
        "year": _to_int(_pick(details, row, "year")),
        "mileage_km": _to_int(_pick(details, row, "mileage")),
        "engine_cm3": _to_int(_pick(details, row, "engine_capacity")),
        "power_hp": _to_int(_pick(details, row, "engine_power")),
        "make": _pick(details, row, "make"),
        "model": _pick(details, row, "model"),
        "fuel": _pick(details, row, "fuel_type"),
        "gearbox": _pick(details, row, "gearbox"),
        "body": details.get("body_type") or "",
        "color": details.get("color") or "",
        "vin": details.get("vin") or "",
        "country_origin": details.get("country_origin") or "",
        "lat": lat,
        "lon": lon,
        "geo_source": geo_source,
        "address": seller_location.get("address") or "",
        "events": [],
    }


def create_app(
    root: str | Path = "data",
    source: str = "otomoto",
    *,
    rps: float = 1.0,
    client_factory: Callable[[Settings], Client] | None = None,
    use_db: bool = False,
    db_url: str | None = None,
) -> FastAPI:
    store = Store(root=Path(root), source=source)
    source_code = source
    cache: dict[str, tuple[float, dict]] = {}
    repo: DatabaseRepo | None = None
    if use_db:
        url = db_url or database_url()
        if not url:
            raise RuntimeError("use_db=True, но DATABASE_URL не задан")
        repo = DatabaseRepo(url)
        db_url = url

    app = FastAPI(title="CarCar dashboard", docs_url=None, redoc_url=None)
    app.mount("/static", StaticFiles(directory=STATIC), name="static")

    def make_client() -> Client:
        settings = Settings(rps=rps)
        return client_factory(settings) if client_factory else Client(settings)

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC / "index.html")

    @app.get("/listing/{listing_id}")
    def listing_page(listing_id: str) -> FileResponse:
        return FileResponse(STATIC / "listing.html")

    def storage_stats() -> dict:
        now = time.monotonic()
        cached = cache.get("storage")
        if cached and now - cached[0] < STATS_TTL:
            return cached[1]
        data = repo.stats() if repo is not None else store.stats() | {"mode": "files"}
        cache["storage"] = (now, data)
        return data

    @app.get("/api/status")
    def status() -> dict:
        heartbeat = store.read_heartbeat()
        control = load_control(store.control_path)
        now = datetime.now(UTC)

        age = None
        started_at = _parse_iso(heartbeat.get("ts")) if heartbeat else None
        if started_at:
            age = max(0.0, (now - started_at).total_seconds())

        interval = float((heartbeat or {}).get("interval") or 60.0)
        stale_after = max(60.0, interval * 4)

        state = "never"
        if control.paused:
            state = "paused"
        elif heartbeat:
            if age is not None and age <= stale_after:
                state = str(heartbeat.get("status") or "running")
            else:
                state = "stale"

        sweep: dict[str, Any] = {}
        sweep_path = store.state_dir / "sweep.json"
        if sweep_path.exists():
            try:
                sweep = json.loads(sweep_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                sweep = {}

        collectors = repo.collectors() if repo is not None else []

        return {
            "now": now.isoformat(),
            "state": state,
            "collectors": collectors,
            "sweep": sweep,
            "age_seconds": round(age, 1) if age is not None else None,
            "stale_after": stale_after,
            "heartbeat": heartbeat,
            "control": control.as_dict(),
            "storage": storage_stats(),
            "polls": store.read_polls(limit=60),
            "runs": store.recent_runs(limit=5),
        }

    @app.get("/api/listings")
    def listings(
        limit: int = 8,
        lat: float | None = None,
        lon: float | None = None,
        radius_km: float | None = None,
        source: str | None = None,
    ) -> dict:
        limit = max(1, min(limit, 24))
        if repo is not None:
            items = repo.recent(
                limit, lat=lat, lon=lon, radius_km=radius_km, source=source
            )
            return {"items": items, "total": len(items), "filtered": lat is not None}

        rows = [] if source and source != source_code else None

        geo = get_geo()
        nearby = lat is not None and lon is not None
        if rows is None:
            rows = store.recent_listings(limit * 25 if nearby else limit)
        items = []
        for row in rows:
            item = dict(row)
            item["has_detail"] = store.find_detail_file(row["id"]) is not None
            if item.get("lat") is None or item.get("lon") is None:
                place = geo.lookup(row.get("city", ""), row.get("region"))
                if place:
                    item["lat"], item["lon"] = place.lat, place.lon
                    item["geo_source"] = "city"
            if nearby and item.get("lat") is not None and item.get("lon") is not None:
                item["distance_km"] = round(
                    distance_km(lat, lon, item["lat"], item["lon"]), 1
                )
            items.append(item)
        if nearby:
            if radius_km and radius_km > 0:
                limit_km = max(1.0, min(radius_km, 1000.0))
                items = [
                    i
                    for i in items
                    if i.get("distance_km") is not None and i["distance_km"] <= limit_km
                ]
            items.sort(key=lambda i: i.get("distance_km", 1e9))
        return {"items": items[:limit], "total": len(items), "filtered": nearby}

    @app.get("/api/metrics")
    def metrics(days: int = 30, months: int = 12) -> dict:
        if repo is None:
            return {"available": False, "by_source": [], "daily": [], "monthly": [], "runs": []}
        return {"available": True, **repo.metrics(days=days, months=months)}

    @app.get("/api/listings/{listing_id}")
    def listing_card(listing_id: str) -> dict:
        card = repo.get(listing_id) if repo is not None else build_card(store, listing_id)
        if not card:
            raise HTTPException(status_code=404, detail="объявление не найдено")
        return card

    @app.post("/api/listings/{listing_id}/fetch")
    def fetch_card(listing_id: str) -> dict:
        if not listing_id.isdigit():
            raise HTTPException(status_code=400, detail="id должен быть числом")

        if repo is not None:
            row = repo.get(listing_id)
            if not row:
                raise HTTPException(status_code=404, detail="объявление не найдено")
            if row.get("has_detail"):
                return {"ok": True, "saved": False, "already": True}
            listing = Listing(
                id=row["external_id"],
                url=row["url"],
                title=row.get("title") or "",
                created_at="",
                price=row.get("price") or 0,
                currency=row.get("currency") or "PLN",
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
                assert db_url is not None
                with DatabaseSink(db_url) as sink, make_client() as client:
                    saved = fetch_detail(
                        client, store, listing, sink=sink, code=row.get("source") or "otomoto"
                    )
            except BlockedError as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            except (FetchError, ParseError) as exc:
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            return {"ok": True, "saved": bool(saved)}

        row = store.find_listing(listing_id)
        if not row:
            raise HTTPException(status_code=404, detail="объявление не найдено в выдаче")
        if store.find_detail_file(listing_id):
            return {"ok": True, "saved": False, "already": True}

        item = Listing(**{k: row[k] for k in Listing.__slots__ if k in row})
        try:
            with make_client() as client:
                path = fetch_detail(client, store, item)
        except BlockedError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except (FetchError, ParseError) as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return {"ok": True, "saved": bool(path)}

    @app.post("/api/control")
    def control_set(payload: ControlIn) -> dict:
        if repo is not None:
            repo.set_paused(payload.source, payload.paused, payload.reason, payload.by)
            return {"ok": True, "source": payload.source, "paused": payload.paused}
        state = save_control(
            store.control_path,
            paused=payload.paused,
            reason=payload.reason,
            by=payload.by,
        )
        return {"ok": True, "control": state.as_dict()}

    return app
