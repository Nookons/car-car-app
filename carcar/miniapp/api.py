"""HTTP API Telegram Mini App.

Один сервис: отдаёт SPA и JSON. Авторизация — Telegram initData → свой JWT.
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..db import database_url
from .auth import AuthError, issue_token, validate_init_data, verify_token
from .repo import MiniAppRepo

STATIC = __import__("pathlib").Path(__file__).parent / "static"


class AuthIn(BaseModel):
    init_data: str = Field(min_length=1, max_length=8192)


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
    app = FastAPI(title="CarCar Mini App", docs_url=None, redoc_url=None)

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

    @app.get("/healthz")
    def healthz() -> dict:
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
        limit: int = Query(default=20, ge=1, le=50),
        offset: int = Query(default=0, ge=0, le=10_000),
        q: str | None = None,
        make: str | None = None,
        model: str | None = None,
        price_min: int | None = Query(default=None, ge=0),
        price_max: int | None = None,
        year_min: int | None = None,
        year_max: int | None = None,
        mileage_max: int | None = None,
        fuel: str | None = None,
        gearbox: str | None = None,
        source: str | None = None,
        lat: float | None = None,
        lon: float | None = None,
        radius_km: float | None = Query(default=None, ge=0, le=1000),
        sort: str = Query(default="new", pattern="^(new|price_asc|price_desc|distance)$"),
    ) -> dict:
        items, total = repo.search(
            limit=limit,
            offset=offset,
            q=q,
            make=make,
            model=model,
            price_min=price_min,
            price_max=price_max,
            year_min=year_min,
            year_max=year_max,
            mileage_max=mileage_max,
            fuel=fuel,
            gearbox=gearbox,
            source=source,
            lat=lat,
            lon=lon,
            radius_km=radius_km,
            sort=sort,
        )
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    @app.get("/api/listings/{listing_id}")
    def listing(listing_id: int) -> dict:
        card = repo.get_listing(listing_id)
        if not card:
            raise HTTPException(status_code=404, detail="объявление не найдено")
        return card

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
