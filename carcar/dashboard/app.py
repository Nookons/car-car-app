"""Дашборд сборщика: статус, пауза и карточки объявлений.

Данные объявлений читаются из Postgres (Supabase) через `DatabaseRepo`.
Файловое хранилище остаётся офлайн-режимом (`--file`) и для служебного
состояния: heartbeat, журнал опросов, пауза.

Если карточка ещё не обогащена (нет фото/VIN), её можно догрузить кнопкой —
дашборд сходит на площадку и запишет фото в базу.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..client import BlockedError, Client, FetchError, GoneError
from ..config import Settings
from ..control import Control, load_control, save_control
from ..db import DatabaseSink, database_url
from ..geo import distance_km, get_geo
from ..parse import Listing, ParseError, html_to_text
from ..runner import fetch_detail
from ..store import Store
from .. import webauth
from .repo import DatabaseRepo

STATIC = Path(__file__).parent / "static"
STATS_TTL = 10.0
DIGITS_RE = re.compile(r"^\s*(\d[\d\s\u00a0\u202f]*)")


class ControlIn(BaseModel):
    paused: bool
    source: str = Field(default="otomoto", max_length=40)
    reason: str | None = Field(default=None, max_length=200)
    by: str = Field(default="dashboard", max_length=40)


class ServiceNoticeIn(BaseModel):
    mode: Literal["paused", "maintenance"]
    reason: str = Field(min_length=1, max_length=500)
    starts_at: datetime
    ends_at: datetime


class AppAnnouncementIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    starts_at: datetime
    ends_at: datetime


class ListingStatusIn(BaseModel):
    status: Literal["active", "removed"]


class DashboardLoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class UserPasswordIn(BaseModel):
    password: str = Field(min_length=12, max_length=128)


admin_audit = logging.getLogger("carcar.dashboard.admin")


def _safe(call, fallback, errors: list[str], name: str):
    try:
        return call()
    except Exception as exc:  # noqa: BLE001
        errors.append(f"{name}: {exc}")
        return fallback


def _parse_iso(value: str | datetime | None) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
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
    metrics_lock = Lock()
    repo: DatabaseRepo | None = None
    dashboard_password = os.environ.get("CARCAR_DASHBOARD_PASSWORD", "")
    session_cookie = "carcar_dashboard_session"
    session_ttl = 8 * 60 * 60

    def session_signature(issued_at: str) -> str:
        return hmac.new(
            dashboard_password.encode(), issued_at.encode(), hashlib.sha256
        ).hexdigest()

    def has_dashboard_session(request: Request) -> bool:
        value = request.cookies.get(session_cookie, "")
        try:
            issued_at, signature = value.split(".", 1)
            age = time.time() - int(issued_at)
        except (ValueError, TypeError):
            return False
        return (
            dashboard_password != ""
            and 0 <= age <= session_ttl
            and hmac.compare_digest(signature, session_signature(issued_at))
        )
    if use_db:
        url = db_url or database_url()
        if not url:
            raise RuntimeError("use_db=True, но DATABASE_URL не задан")
        repo = DatabaseRepo(url)
        db_url = url

    app = FastAPI(title="CarCar dashboard", docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def protect_dashboard(request: Request, call_next):
        path = request.url.path
        if path.startswith("/static/") or path in {"/api/session", "/api/session/logout", "/"}:
            return await call_next(request)
        if not dashboard_password:
            if path.startswith("/api/"):
                return JSONResponse(
                    {"detail": "администрирование выключено: не задан CARCAR_DASHBOARD_PASSWORD"},
                    status_code=503,
                )
            return RedirectResponse("/", status_code=303)
        if has_dashboard_session(request):
            return await call_next(request)
        if path.startswith("/api/"):
            return JSONResponse({"detail": "нужен вход в дашборд"}, status_code=401)
        return RedirectResponse("/", status_code=303)

    app.mount("/static", StaticFiles(directory=STATIC), name="static")

    def make_client() -> Client:
        settings = Settings(rps=rps, timeout=10, retries=1)
        return client_factory(settings) if client_factory else Client(settings)

    def dashboard_page(filename: str) -> HTMLResponse:
        body = (STATIC / filename).read_text(encoding="utf-8")
        for asset in ("style.css", "app.js", "listing.js"):
            version = hashlib.sha256((STATIC / asset).read_bytes()).hexdigest()[:12]
            body = body.replace(f'/static/{asset}"', f'/static/{asset}?v={version}"')
        return HTMLResponse(body, headers={"Cache-Control": "no-store"})

    @app.get("/")
    def index() -> HTMLResponse:
        return dashboard_page("index.html")

    @app.get("/api/session")
    def session_status(request: Request) -> dict:
        return {"authenticated": bool(dashboard_password and has_dashboard_session(request))}

    @app.post("/api/session")
    def login(payload: DashboardLoginIn, response: Response) -> dict:
        if not dashboard_password:
            raise HTTPException(status_code=503, detail="вход по паролю не настроен")
        if not hmac.compare_digest(payload.password, dashboard_password):
            raise HTTPException(status_code=401, detail="неверный пароль")
        issued_at = str(int(time.time()))
        response.set_cookie(
            session_cookie,
            f"{issued_at}.{session_signature(issued_at)}",
            max_age=session_ttl,
            httponly=True,
            secure=True,
            samesite="strict",
            path="/",
        )
        return {"ok": True}

    @app.post("/api/session/logout")
    def logout(response: Response) -> dict:
        response.delete_cookie(
            session_cookie, path="/", secure=True, httponly=True, samesite="strict"
        )
        return {"ok": True}

    @app.get("/listing/{listing_id}")
    def listing_page(listing_id: str) -> HTMLResponse:
        return dashboard_page("listing.html")

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
        heartbeat = {} if repo is not None else store.read_heartbeat()
        control = Control() if repo is not None else load_control(store.control_path)
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

        errors: list[str] = []
        sweep: dict[str, Any] = {}
        if repo is not None:
            try:
                sweep = repo.sweep_state(source_code)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"sweep: {exc}")
        sweep_path = store.state_dir / "sweep.json"
        if repo is None and sweep_path.exists():
            try:
                sweep = json.loads(sweep_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                sweep = {}

        try:
            collectors = repo.collectors() if repo is not None else []
        except Exception as exc:  # noqa: BLE001
            collectors = []
            errors.append(f"collectors: {exc}")

        for collector in collectors:
            checked_at = _parse_iso(collector.get("heartbeat_at") or collector.get("last_poll_at"))
            interval = max(15.0, float(collector.get("interval_seconds") or 60))
            if checked_at and collector.get("status") == "running":
                if (now - checked_at).total_seconds() > max(60.0, interval * 4):
                    collector["status"] = "stale"

        notices = _safe(
            lambda: repo.service_notices() if repo is not None else [],
            [], errors, "service notices",
        )

        if not heartbeat and collectors:
            active_notices = {
                notice["source"] for notice in notices
                if notice.get("active") and notice.get("source")
            }
            states = [
                "paused" if collector.get("paused") or collector.get("source") in active_notices
                else str(collector.get("status") or "never")
                for collector in collectors
            ]
            if "error" in states:
                state = "error"
            elif "stale" in states:
                state = "stale"
            elif "running" in states:
                state = "running"
            elif all(item == "paused" for item in states):
                state = "paused"
            elif any(item == "paused" for item in states):
                state = "paused"
            elif all(item == "never" for item in states):
                state = "never"
            else:
                state = "idle"
            timestamps = [_parse_iso(item.get("last_poll_at")) for item in collectors]
            timestamps = [item for item in timestamps if item]
            if timestamps:
                started_at = max(timestamps)
                age = max(0.0, (now - started_at).total_seconds())

        return {
            "now": now.isoformat(),
            "state": state,
            "collectors": collectors,
            "service_notices": notices,
            "sweep": sweep,
            "age_seconds": round(age, 1) if age is not None else None,
            "stale_after": stale_after,
            "heartbeat": heartbeat,
            "control": control.as_dict(),
            "storage": storage_stats(),
            "polls": _safe(
                lambda: repo.polls(limit=60),
                store.read_polls(limit=60),
                errors,
                "polls",
            )
            if repo is not None
            else store.read_polls(limit=60),
            "runs": _safe(lambda: repo.runs(limit=5), store.recent_runs(limit=5), errors, "runs")
            if repo is not None
            else store.recent_runs(limit=5),
            "errors": errors,
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

    @app.get("/api/manage/listings")
    def manage_listings(
        status: Literal["all", "active", "removed"] = "all",
        source: str | None = Query(default=None, max_length=40),
        query: str | None = Query(default=None, max_length=100),
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=10_000_000),
    ) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="полный список требует PostgreSQL")
        return repo.search_listings(
            status=status, source=source, query=query.strip() if query else None,
            limit=limit, offset=offset,
        )

    @app.get("/api/funnel-metrics")
    def funnel_metrics(days: int = Query(default=30, ge=1, le=365)) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="аналитика требует PostgreSQL")
        return repo.funnel_metrics(days)

    @app.get("/api/metrics")
    def metrics(days: int = 30, months: int = 12) -> dict:
        if repo is None:
            return {"available": False, "by_source": [], "daily": [], "monthly": [], "runs": []}
        days, months = max(1, min(days, 365)), max(1, min(months, 36))
        key = f"metrics:{days}:{months}"
        with metrics_lock:
            cached = cache.get(key)
            if cached and time.monotonic() - cached[0] < 30:
                return cached[1]
            result = {"available": True, **repo.metrics(days=days, months=months)}
            cache[key] = (time.monotonic(), result)
            return result

    @app.get("/api/logs")
    def logs(limit: int = Query(default=100, ge=1, le=200)) -> dict:
        if repo is None:
            return {"items": []}
        return {"items": repo.logs(limit=limit)}

    @app.get("/api/user-metrics")
    def user_metrics(
        days: int = Query(default=30, ge=1, le=90),
        limit: int = Query(default=100, ge=1, le=200),
        offset: int = Query(default=0, ge=0, le=100_000),
        query: str | None = Query(default=None, max_length=100),
    ) -> dict:
        """Пользовательская аналитика читается из той же БД, что и объявления."""
        if repo is None:
            raise HTTPException(status_code=503, detail="управление пользователями требует PostgreSQL")
        return repo.user_activity_metrics(days, limit, offset, query)

    @app.get("/api/user-metrics/{user_id}")
    def user_metrics_detail(
        user_id: int,
        days: int = Query(default=30, ge=1, le=90),
        search_limit: int = Query(default=100, ge=1, le=200),
    ) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="управление пользователями требует PostgreSQL")
        detail = repo.user_activity_detail(user_id, days, search_limit)
        if detail is None:
            raise HTTPException(status_code=404, detail="пользователь не найден")
        return detail

    @app.get("/api/users/{user_id}/sessions")
    def user_sessions(user_id: int) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="управление пользователями требует PostgreSQL")
        if repo.user_activity_detail(user_id, days=1, search_limit=1) is None:
            raise HTTPException(status_code=404, detail="пользователь не найден")
        return {"items": repo.user_web_sessions(user_id)}

    @app.post("/api/users/{user_id}/sessions/revoke")
    def revoke_user_sessions(user_id: int) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="управление пользователями требует PostgreSQL")
        revoked = repo.revoke_user_web_session(user_id)
        admin_audit.info("action=revoke_all_sessions user_id=%s count=%s", user_id, revoked)
        return {"revoked": revoked, "tokens_revoked": True}

    @app.post("/api/users/{user_id}/sessions/{session_id}/revoke")
    def revoke_user_session(user_id: int, session_id: int) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="управление пользователями требует PostgreSQL")
        revoked = repo.revoke_user_web_session(user_id, session_id)
        if not revoked:
            raise HTTPException(status_code=404, detail="активная сессия не найдена")
        admin_audit.info("action=revoke_web_session user_id=%s session_id=%s", user_id, session_id)
        return {"revoked": True}

    @app.post("/api/users/{user_id}/password")
    def set_user_password(user_id: int, payload: UserPasswordIn) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="управление пользователями требует PostgreSQL")
        try:
            webauth.validate_password(payload.password)
        except webauth.AuthInputError as exc:
            raise HTTPException(status_code=422, detail="пароль слишком простой") from exc
        updated = repo.set_user_password(user_id, webauth.hash_password(payload.password))
        if not updated:
            if repo.user_activity_detail(user_id, days=1, search_limit=1) is None:
                raise HTTPException(status_code=404, detail="пользователь не найден")
            raise HTTPException(status_code=409, detail="у пользователя нет email или подтверждённого телефона")
        admin_audit.info("action=admin_set_password user_id=%s sessions_revoked=true", user_id)
        return {"ok": True, "sessions_revoked": True}

    @app.get("/api/listings/{listing_id}")
    def listing_card(listing_id: str) -> dict:
        card = repo.get(listing_id) if repo is not None else build_card(store, listing_id)
        if not card:
            raise HTTPException(status_code=404, detail="объявление не найдено")
        return card

    @app.patch("/api/listings/{listing_id}/status")
    def admin_listing_status(listing_id: int, payload: ListingStatusIn) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="управление требует PostgreSQL")
        if not repo.update_listing_admin(listing_id, {"status": payload.status}):
            raise HTTPException(status_code=404, detail="объявление не найдено")
        admin_audit.info("action=admin_listing_status listing_id=%s status=%s", listing_id, payload.status)
        return {"ok": True}

    @app.delete("/api/listings/{listing_id}")
    def admin_delete_listing(listing_id: int) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="управление требует PostgreSQL")
        if not repo.delete_listing_admin(listing_id):
            raise HTTPException(status_code=404, detail="объявление не найдено")
        admin_audit.warning("action=admin_delete_listing listing_id=%s", listing_id)
        return {"ok": True}

    @app.post("/api/listings/{listing_id}/fetch")
    def fetch_card(listing_id: str, refresh: bool = False) -> dict:
        if not listing_id.isdigit():
            raise HTTPException(status_code=400, detail="id должен быть числом")

        if repo is not None:
            row = repo.get(listing_id)
            if not row:
                raise HTTPException(status_code=404, detail="объявление не найдено")
            if row.get("has_detail") and not refresh:
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
            except GoneError as exc:
                raise HTTPException(status_code=410, detail="Объявление снято на исходной площадке") from exc
            except BlockedError as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            except (FetchError, ParseError) as exc:
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            return {"ok": True, "saved": bool(saved)}

        row = store.find_listing(listing_id)
        if not row:
            raise HTTPException(status_code=404, detail="объявление не найдено в выдаче")
        if store.find_detail_file(listing_id) and not refresh:
            return {"ok": True, "saved": False, "already": True}

        item = Listing(**{k: row[k] for k in Listing.__slots__ if k in row})
        try:
            with make_client() as client:
                path = fetch_detail(client, store, item, refresh=refresh)
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

    @app.put("/api/service-notices/{source}")
    def save_service_notice(source: str, payload: ServiceNoticeIn) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="для расписания нужна база данных")
        starts_at = payload.starts_at
        ends_at = payload.ends_at
        if starts_at.tzinfo is None or ends_at.tzinfo is None:
            raise HTTPException(status_code=422, detail="укажите даты с часовым поясом")
        if not payload.reason.strip():
            raise HTTPException(status_code=422, detail="укажите причину")
        if ends_at <= starts_at:
            raise HTTPException(status_code=422, detail="окончание должно быть позже начала")
        try:
            repo.set_service_notice(
                source, payload.mode, payload.reason.strip(), starts_at, ends_at
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"ok": True, "source": source}

    @app.delete("/api/service-notices/{source}")
    def clear_service_notice(source: str) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="для расписания нужна база данных")
        repo.set_service_notice(source, None, None, None, None)
        return {"ok": True, "source": source}

    @app.get("/api/app-announcement")
    def get_app_announcement() -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="для объявления нужна база данных")
        return {"announcement": repo.app_announcement()}

    @app.put("/api/app-announcement")
    def save_app_announcement(payload: AppAnnouncementIn) -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="для объявления нужна база данных")
        if payload.starts_at.tzinfo is None or payload.ends_at.tzinfo is None:
            raise HTTPException(status_code=422, detail="укажите даты с часовым поясом")
        if not payload.message.strip():
            raise HTTPException(status_code=422, detail="текст объявления не может быть пустым")
        if payload.ends_at <= payload.starts_at:
            raise HTTPException(status_code=422, detail="окончание должно быть позже начала")
        repo.set_app_announcement(payload.message.strip(), payload.starts_at, payload.ends_at)
        return {"ok": True}

    @app.delete("/api/app-announcement")
    def delete_app_announcement() -> dict:
        if repo is None:
            raise HTTPException(status_code=503, detail="для объявления нужна база данных")
        repo.clear_app_announcement()
        return {"ok": True}

    return app
