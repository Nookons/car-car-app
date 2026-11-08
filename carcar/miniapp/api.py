"""HTTP API Telegram Mini App.

Один сервис: отдаёт SPA и JSON. Авторизация — Telegram initData → свой JWT.
"""

from __future__ import annotations

import asyncio
import hmac
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..cache import Cache
from ..db import database_url
from .auth import AuthError, issue_token, validate_init_data, verify_token
from .repo import MiniAppRepo

STATIC = __import__("pathlib").Path(__file__).parent / "static"


class AuthIn(BaseModel):
    init_data: str = Field(min_length=1, max_length=8192)


class LikeIn(BaseModel):
    on: bool = True


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class UserPatch(BaseModel):
    lang: str | None = Field(default=None, pattern="^(ru|pl|uk|en)$")
    notify_new: bool | None = None
    digest: bool | None = None


class SubscriptionIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    criteria: dict[str, Any]
    active: bool = True


class SubscriptionPatch(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    criteria: dict[str, Any] | None = None
    active: bool | None = None


def create_app(
    *,
    db_url: str | None = None,
    bot_token: str | None = None,
    jwt_secret: str | None = None,
    dev_tg_id: int | None = None,
) -> FastAPI:
    url = db_url or database_url()
    if not url:
        raise RuntimeError("нужен DATABASE_URL")
    bot_token = bot_token or os.environ.get("CARCAR_BOT_TOKEN", "")
    dev_allowed = os.environ.get("CARCAR_ALLOW_DEV") == "1"
    jwt_secret = (
        jwt_secret
        or os.environ.get("CARCAR_JWT_SECRET")
        or (bot_token if bot_token else ("dev-secret" if dev_allowed else ""))
    )
    if not jwt_secret:
        raise RuntimeError("нужен CARCAR_JWT_SECRET или CARCAR_BOT_TOKEN")
    dev_tg_id = dev_tg_id or (
        int(os.environ["CARCAR_DEV_TG_ID"]) if os.environ.get("CARCAR_DEV_TG_ID") else None
    )
    if dev_tg_id and not dev_allowed:
        dev_tg_id = None

    repo = MiniAppRepo(url)
    cache = Cache()
    dev_token = os.environ.get("CARCAR_DEV_TOKEN", "")
    ingest_token = os.environ.get("CARCAR_INGEST_TOKEN", "")

    public_url = os.environ.get("CARCAR_PUBLIC_URL", "").rstrip("/")
    api_url = os.environ.get("CARCAR_API_URL", "").rstrip("/")
    webhook_secret = os.environ.get("CARCAR_WEBHOOK_SECRET", "")

    WARM_QUERIES = [
        "limit=20&offset=0&sort=new",
        "limit=1&offset=0&sort=new",
        "limit=20&offset=0&sort=new&body=sedan",
        "limit=20&offset=0&sort=new&body=suv",
        "limit=20&offset=0&sort=new&make=BMW",
        "limit=20&offset=0&sort=new&make=Audi",
        "limit=20&offset=0&sort=new&make=Volkswagen",
        "limit=20&offset=0&sort=new&make=Toyota",
        "limit=20&offset=0&sort=new&make=Skoda",
        "limit=20&offset=0&sort=new&gearbox=automatic",
    ]

    async def warm_loop() -> None:
        """Держит кэш популярных выдач горячим: первый пользователь не ждёт БД."""
        port = os.environ.get("PORT", "8080")
        await asyncio.sleep(5)
        while True:
            async with httpx.AsyncClient(timeout=45) as client:
                for query in WARM_QUERIES:
                    try:
                        await client.get(f"http://127.0.0.1:{port}/api/listings?{query}")
                    except Exception:  # noqa: BLE001
                        break
            await asyncio.sleep(45)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        # Одноразовая миграция: включает CARCAR_AUTO_MIGRATE=1.
        if os.environ.get("CARCAR_AUTO_MIGRATE") == "1":
            try:
                schema = (Path(__file__).resolve().parent.parent / "schema.sql").read_text()
                with repo.pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(schema)
                conn.commit()
                print("схема применена при старте")
            except Exception as exc:  # noqa: BLE001
                print(f"автомиграция не удалась: {exc}")

        warm_task = None
        if os.environ.get("CARCAR_WARM", "1") == "1":
            warm_task = asyncio.create_task(warm_loop())

        # Бот работает через вебхук: поллинг с двух машин конфликтует.
        if bot_token and api_url:
            from ..bot import Bot

            try:
                Bot(bot_token, public_url).set_webhook(
                    f"{api_url}/bot/webhook", webhook_secret or None
                )
            except Exception as exc:  # noqa: BLE001
                print(f"не удалось поставить вебхук: {exc}")
        try:
            yield
        finally:
            if warm_task is not None:
                warm_task.cancel()
        repo.close()

    app = FastAPI(
        title="CarCar Mini App", docs_url=None, redoc_url=None, lifespan=lifespan
    )

    # Фронт живёт на Vercel (или localhost:3100) — это другой origin.
    origins = os.environ.get(
        "CARCAR_CORS_ORIGINS",
        "http://127.0.0.1:3100,http://localhost:3100,http://localhost:3000",
    ).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins if origin.strip()],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.mount("/static", StaticFiles(directory=STATIC), name="static")

    def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="нет токена")
        try:
            user_id = verify_token(authorization[7:], jwt_secret)
        except AuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        user = repo.get_user(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="пользователь не найден")
        return user

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC / "index.html")

    @app.post("/api/ingest/events")
    def ingest_events(
        payload: dict[str, Any],
        token: str | None = Header(default=None, alias="X-Ingest-Token"),
    ) -> dict:
        """Сборщик публикует события через API: у него нет прямого доступа к Redis."""
        if not ingest_token or not hmac.compare_digest(token or "", ingest_token):
            raise HTTPException(status_code=403, detail="нет доступа")
        events = payload.get("events") or []
        if not isinstance(events, list) or len(events) > 200:
            raise HTTPException(status_code=400, detail="ожидаю events[] до 200")
        from ..bus import make_bus

        bus = make_bus()
        published = 0
        for event in events:
            if not isinstance(event, dict) or not event.get("external_id"):
                continue
            bus.publish(
                {
                    "type": event.get("type", "listing.created"),
                    "source": event.get("source", "otomoto"),
                    "external_id": str(event["external_id"]),
                }
            )
            published += 1
        return {"ok": True, "published": published}

    @app.post("/api/dev/publish")
    def dev_publish(
        payload: dict[str, Any],
        token: str | None = Header(default=None, alias="X-Dev-Token"),
    ) -> dict:
        """Служебный вход для проверки шины: публикует событие о объявлении."""
        if not dev_token or not hmac.compare_digest(token or "", dev_token):
            raise HTTPException(status_code=403, detail="нет доступа")
        from ..bus import make_bus

        event = {
            "type": payload.get("type", "listing.created"),
            "source": payload.get("source", "otomoto"),
            "external_id": str(payload.get("external_id", "")),
        }
        bus = make_bus()
        bus.publish(event)
        return {"ok": True, "event": event, "bus": type(bus).__name__}

    @app.get("/healthz")
    def healthz() -> dict:
        return {"ok": True, "cache": "redis" if cache.enabled else "memory"}

    @app.post("/bot/webhook")
    def bot_webhook(
        update: dict[str, Any],
        secret: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
    ) -> dict:
        if webhook_secret and not hmac.compare_digest(secret or "", webhook_secret):
            raise HTTPException(status_code=403, detail="плохой секрет")
        callback = update.get("callback_query")
        if callback:
            from ..bot import Bot

            bot = Bot(bot_token, public_url)
            data = callback.get("data") or ""
            if data.startswith("specs:"):
                try:
                    listing_id = int(data.split(":", 1)[1])
                except ValueError:
                    listing_id = 0
                chat_id = (callback.get("message") or {}).get("chat", {}).get("id")
                if listing_id and chat_id:
                    bot.send_specs(chat_id, listing_id)
            bot.answer_callback(callback.get("id", ""))
            return {"ok": True}

        message = update.get("message") or {}
        text = (message.get("text") or "").strip()
        chat_id = (message.get("chat") or {}).get("id")
        if chat_id and text.startswith("/start"):
            from ..bot import Bot

            Bot(bot_token, public_url).reply_start(chat_id)
        return {"ok": True}

    # -- авторизация -------------------------------------------------------
    @app.post("/api/auth")
    def auth(payload: AuthIn) -> dict:
        if payload.init_data == "dev" and dev_allowed and dev_tg_id:
            user = repo.ensure_user(
                {"id": dev_tg_id, "username": "dev", "first_name": "Dev", "last_name": ""}
            )
        else:
            if not bot_token:
                raise HTTPException(status_code=503, detail="бот не настроен")
            try:
                data = validate_init_data(payload.init_data, bot_token)
            except AuthError as exc:
                raise HTTPException(status_code=401, detail=str(exc)) from exc
            user = repo.ensure_user(data["user"])
        return {"token": issue_token(user["id"], jwt_secret), "user": user}

    # -- профиль -----------------------------------------------------------
    @app.get("/api/me")
    def me(user: dict = Depends(current_user)) -> dict:
        return user

    @app.patch("/api/me")
    def patch_me(payload: UserPatch, user: dict = Depends(current_user)) -> dict:
        return repo.update_user(
            user["id"], lang=payload.lang, notify_new=payload.notify_new, digest=payload.digest
        )

    # -- объявления ---------------------------------------------------------
    @app.get("/api/listings")
    def listings(
        request: Request,
        limit: int = Query(default=20, ge=1, le=50),
        offset: int = Query(default=0, ge=0, le=10_000),
        q: str | None = None,
        make: str | None = None,
        model: str | None = None,
        price_min: int | None = Query(default=None, ge=0),
        price_max: int | None = None,
        year_min: int | None = None,
        year_max: int | None = None,
        mileage_min: int | None = None,
        mileage_max: int | None = None,
        fuel: str | None = None,
        gearbox: str | None = None,
        body: str | None = None,
        drive: str | None = None,
        condition: str | None = None,
        seller_type: str | None = None,
        color: str | None = None,
        doors: int | None = None,
        seats: int | None = None,
        power_min: int | None = None,
        power_max: int | None = None,
        engine_min: int | None = None,
        engine_max: int | None = None,
        source: str | None = None,
        lat: float | None = None,
        lon: float | None = None,
        radius_km: float | None = Query(default=None, ge=0, le=1000),
        sort: str = Query(default="new", pattern="^(new|price_asc|price_desc|distance)$"),
    ) -> dict:
        key = f"list:{request.url.query}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        items, total, approx = repo.search(
            limit=limit,
            offset=offset,
            q=q,
            make=make,
            model=model,
            price_min=price_min,
            price_max=price_max,
            year_min=year_min,
            year_max=year_max,
            mileage_min=mileage_min,
            mileage_max=mileage_max,
            fuel=fuel,
            gearbox=gearbox,
            body=body,
            drive=drive,
            condition=condition,
            seller_type=seller_type,
            color=color,
            doors=doors,
            seats=seats,
            power_min=power_min,
            power_max=power_max,
            engine_min=engine_min,
            engine_max=engine_max,
            source=source,
            lat=lat,
            lon=lon,
            radius_km=radius_km,
            sort=sort,
        )
        payload = {
            "items": items,
            "total": total,
            "approx": approx,
            "limit": limit,
            "offset": offset,
        }
        cache.set(key, payload, ttl=120)
        return payload

    @app.get("/api/listings/{listing_id}")
    def listing(listing_id: int) -> dict:
        key = f"card:v5:{listing_id}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        card = repo.get_listing(listing_id)
        if not card:
            raise HTTPException(status_code=404, detail="объявление не найдено")
        cache.set(key, card, ttl=600)
        return card

    # -- справочник фильтров ------------------------------------------------
    @app.get("/api/filters/makes")
    def filter_makes() -> dict:
        cached = cache.get("filters:makes")
        if cached is not None:
            return cached
        payload = {"items": repo.filter_makes()}
        cache.set("filters:makes", payload, ttl=300)
        return payload

    @app.get("/api/filters/models")
    def filter_models(make: str = Query(min_length=1)) -> dict:
        key = f"filters:models:{make}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        payload = {"items": repo.filter_models(make)}
        cache.set(key, payload, ttl=300)
        return payload

    @app.get("/api/filters/cities")
    def filter_cities(q: str | None = None) -> dict:
        key = f"filters:cities:{q or ''}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        payload = {"items": repo.filter_cities(q)}
        cache.set(key, payload, ttl=300)
        return payload

    @app.get("/api/filters/options")
    def filter_options(make: str | None = None, model: str | None = None) -> dict:
        key = f"filters:options:{make or ''}:{model or ''}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        payload = repo.filter_options(make, model)
        cache.set(key, payload, ttl=300)
        return payload

    # -- просмотры и реакции -----------------------------------------------
    def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
        if not authorization or not authorization.startswith("Bearer "):
            return None
        try:
            return repo.get_user(verify_token(authorization[7:], jwt_secret))
        except AuthError:
            return None

    @app.post("/api/listings/{listing_id}/view")
    def record_view(listing_id: int, user: dict = Depends(current_user)) -> dict:
        return {"views": repo.record_view(user["id"], listing_id)}

    @app.post("/api/listings/{listing_id}/like")
    def like(listing_id: int, payload: LikeIn, user: dict = Depends(current_user)) -> dict:
        return repo.like(user["id"], listing_id, payload.on)

    @app.post("/api/listings/{listing_id}/repost")
    def repost(listing_id: int, user: dict = Depends(current_user)) -> dict:
        return repo.repost(user["id"], listing_id)

    @app.get("/api/listings/{listing_id}/comments")
    def comments(listing_id: int, limit: int = Query(default=50, ge=1, le=100)) -> dict:
        return {"items": repo.comments(listing_id, limit)}

    @app.post("/api/listings/{listing_id}/comments")
    def add_comment(
        listing_id: int, payload: CommentIn, user: dict = Depends(current_user)
    ) -> dict:
        return repo.add_comment(user["id"], listing_id, payload.text.strip())

    # -- лента и рекомендации ----------------------------------------------
    @app.get("/api/feed")
    def feed(
        mode: str = Query(default="for_you", pattern="^(for_you|popular)$"),
        limit: int = Query(default=10, ge=1, le=30),
        offset: int = Query(default=0, ge=0, le=5000),
        user: dict | None = Depends(optional_user),
    ) -> dict:
        items = repo.feed(
            user["id"] if user else None, mode=mode, limit=limit, offset=offset
        )
        return {"items": items, "mode": mode}

    @app.get("/api/recommendations")
    def recommendations(
        limit: int = Query(default=6, ge=1, le=20),
        user: dict = Depends(current_user),
    ) -> dict:
        return {"items": repo.feed(user["id"], mode="for_you", limit=limit)}

    # -- подписки ----------------------------------------------------------
    @app.get("/api/subscriptions")
    def subscriptions(user: dict = Depends(current_user)) -> dict:
        return {"items": repo.subscriptions(user["id"])}

    @app.post("/api/subscriptions")
    def create_subscription(payload: SubscriptionIn, user: dict = Depends(current_user)) -> dict:
        return repo.create_subscription(user["id"], payload.name, payload.criteria)

    @app.patch("/api/subscriptions/{sub_id}")
    def patch_subscription(
        sub_id: int, payload: SubscriptionPatch, user: dict = Depends(current_user)
    ) -> dict:
        updated = repo.update_subscription(
            user["id"], sub_id, **payload.model_dump(exclude_none=True)
        )
        if not updated:
            raise HTTPException(status_code=404, detail="подписка не найдена")
        return updated

    @app.delete("/api/subscriptions/{sub_id}")
    def delete_subscription(sub_id: int, user: dict = Depends(current_user)) -> dict:
        return {"ok": repo.delete_subscription(user["id"], sub_id)}

    # -- избранное ---------------------------------------------------------
    @app.get("/api/favorites")
    def favorites(user: dict = Depends(current_user)) -> dict:
        return {"items": repo.favorites(user["id"])}

    @app.post("/api/favorites/{listing_id}")
    def add_favorite(listing_id: int, user: dict = Depends(current_user)) -> dict:
        return {"ok": repo.add_favorite(user["id"], listing_id)}

    @app.delete("/api/favorites/{listing_id}")
    def remove_favorite(listing_id: int, user: dict = Depends(current_user)) -> dict:
        return {"ok": repo.remove_favorite(user["id"], listing_id)}

    return app
