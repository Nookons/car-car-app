"""HTTP-ручки веб-авторизации (браузер, не Telegram).

Маршруты монтируются в общий API рядом с `/api/auth` для Mini App. Телеграм-
путь не трогаем: `POST /api/auth` по-прежнему принимает `init_data` и отдаёт
JWT. Здесь — только e-mail/пароль, cookie-сессии, подтверждение почты и
телефона.

Сессия — httpOnly-cookie `carcar_session`. Все изменяющие запросы с cookie
дополнительно требуют `X-CSRF-Token`, значение которого лежит в читаемой
cookie `carcar_csrf` и хеш которого привязан к сессии. Проверка стоит в
`current_user` (см. `api.py`), поэтому её нельзя забыть на новой ручке.
"""

from __future__ import annotations

import contextlib
import hmac
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from psycopg import errors as pg_errors
from pydantic import BaseModel, Field

from .. import webauth
from ..webauth import AuthInputError
from ..webauth_notify import (
    send_password_reset_email,
    send_phone_code,
    send_verification_email,
)
from . import social
from .auth import AuthError, validate_telegram_login
from .repo import MiniAppRepo

LIMITER = webauth.RateLimiter()

# Один и тот же ответ на «нет пользователя» и «неверный пароль»: не даём
# перебором выяснять, какие адреса зарегистрированы.
_INVALID_CREDENTIALS = "invalid_credentials"
_DUMMY_HASH: str | None = None


def _dummy_hash() -> str:
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = webauth.hash_password("carcar-dummy-password-1")
    return _DUMMY_HASH


@dataclass(frozen=True)
class WebAuthSettings:
    public_url: str
    jwt_secret: str
    dev: bool
    cookie_secure: bool
    cookie_samesite: str
    session_ttl: int = webauth.SESSION_TTL
    bot_token: str = ""
    bot_username: str = "CarCarFinderBot"
    telegram_widget: bool = True

    @classmethod
    def from_env(cls) -> WebAuthSettings:
        public_url = (os.environ.get("CARCAR_PUBLIC_URL") or "").rstrip("/")
        secure = os.environ.get("CARCAR_COOKIE_SECURE", "auto").lower()
        return cls(
            public_url=public_url,
            jwt_secret=os.environ.get("CARCAR_JWT_SECRET", ""),
            dev=os.environ.get("CARCAR_ALLOW_DEV") == "1",
            cookie_secure=secure in ("1", "true", "yes")
            or (secure == "auto" and public_url.startswith("https://")),
            cookie_samesite=(os.environ.get("CARCAR_COOKIE_SAMESITE") or "lax").lower(),
            session_ttl=int(os.environ.get("CARCAR_SESSION_TTL", str(webauth.SESSION_TTL))),
            bot_token=os.environ.get("CARCAR_BOT_TOKEN", ""),
            bot_username=(os.environ.get("CARCAR_BOT_USERNAME") or "CarCarFinderBot").lstrip("@"),
            telegram_widget=os.environ.get("CARCAR_TELEGRAM_WIDGET", "1") != "0",
        )


# -- модели запросов --------------------------------------------------------


class RegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)
    name: str | None = Field(default=None, max_length=80)


class LoginIn(BaseModel):
    login: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class TokenIn(BaseModel):
    token: str = Field(min_length=8, max_length=256)


class EmailIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class ResetIn(BaseModel):
    token: str = Field(min_length=8, max_length=256)
    password: str = Field(min_length=1, max_length=256)


class PhoneIn(BaseModel):
    phone: str = Field(min_length=4, max_length=32)


class PhoneVerifyIn(BaseModel):
    phone: str = Field(min_length=4, max_length=32)
    code: str = Field(min_length=4, max_length=8)


class PasswordIn(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class EmailStartIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)


# -- вспомогательное --------------------------------------------------------


def _ip(request: Request) -> str:
    if os.environ.get("CARCAR_TRUST_PROXY") == "1":
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


def _limit(key: str, limit: int, window: int) -> None:
    retry = LIMITER.retry_after(key, limit, window)
    if retry is not None:
        raise HTTPException(
            status_code=429,
            detail="rate_limited",
            headers={"Retry-After": str(retry)},
        )


def _input(call: Callable[[], str]) -> str:
    try:
        return call()
    except AuthInputError as exc:
        raise HTTPException(status_code=400, detail=exc.code) from exc


def _clean_name(value: str | None) -> str | None:
    if not value:
        return None
    name = " ".join(value.split())
    return name[:80] or None


def _secure_request(request: Request, settings: WebAuthSettings) -> bool:
    if settings.cookie_secure:
        return True
    return request.url.scheme == "https" or (
        request.headers.get("x-forwarded-proto", "").split(",")[0].strip() == "https"
    )


def _cookie_kwargs(request: Request, settings: WebAuthSettings) -> dict[str, Any]:
    """SameSite=Lax хватает, когда фронт и API на одном origin (прокси Next).

    Если API вызывают напрямую с другого домена, нужен `CARCAR_COOKIE_SAMESITE=none`
    и HTTPS: иначе браузер не отправит cookie и сессия «не запомнится».
    """
    secure = _secure_request(request, settings)
    samesite = settings.cookie_samesite
    if samesite not in {"lax", "strict", "none"}:
        samesite = "lax"
    if samesite == "none":
        secure = True
    return {"secure": secure, "samesite": samesite, "path": "/"}


def _start_session(
    repo: MiniAppRepo,
    request: Request,
    response: Response,
    settings: WebAuthSettings,
    user_id: int,
) -> str:
    token = webauth.new_token()
    csrf = webauth.new_token(24)
    repo.create_web_session(
        user_id,
        webauth.token_hash(token),
        webauth.token_hash(csrf),
        ttl=settings.session_ttl,
        user_agent=request.headers.get("user-agent"),
    )
    kwargs = _cookie_kwargs(request, settings)
    response.set_cookie(
        webauth.SESSION_COOKIE,
        token,
        max_age=settings.session_ttl,
        httponly=True,
        **kwargs,
    )
    response.set_cookie(
        webauth.CSRF_COOKIE,
        csrf,
        max_age=settings.session_ttl,
        httponly=False,
        **kwargs,
    )
    return csrf


def _clear_session(response: Response) -> None:
    response.delete_cookie(webauth.SESSION_COOKIE, path="/")
    response.delete_cookie(webauth.CSRF_COOKIE, path="/")


def csrf_ok(request: Request, session: dict[str, Any]) -> bool:
    header = request.headers.get("x-csrf-token", "")
    cookie = request.cookies.get(webauth.CSRF_COOKIE, "")
    if not header or not cookie or not webauth.safe_equal(header, cookie):
        return False
    return hmac.compare_digest(webauth.token_hash(header), session.get("csrf_hash", ""))


def _public_url(request: Request, settings: WebAuthSettings) -> str:
    # Только настроенный адрес: Origin/Host приходят от клиента, и подстановка
    # их в ссылку из письма позволила бы увести человека на чужой домен.
    if settings.public_url:
        return settings.public_url
    return str(request.base_url).rstrip("/")


def _issue_email_verification(
    repo: MiniAppRepo,
    background: BackgroundTasks,
    request: Request,
    settings: WebAuthSettings,
    user: dict[str, Any],
) -> str | None:
    email = user.get("email")
    if not email or user.get("email_verified"):
        return None
    token = webauth.new_token()
    repo.issue_auth_token(
        user["id"],
        "email_verify",
        email,
        ttl=webauth.EMAIL_TOKEN_TTL,
        token_hash=webauth.token_hash(token),
    )
    link = f"{_public_url(request, settings)}/verify-email?token={quote(token)}"
    background.add_task(send_verification_email, email, link)
    return token


def _issue_phone_code(
    repo: MiniAppRepo,
    background: BackgroundTasks,
    settings: WebAuthSettings,
    user_id: int,
    phone: str,
    kind: str,
) -> str:
    code = webauth.new_code()
    digest = webauth.code_hash(
        code, settings.jwt_secret, kind=kind, destination=phone
    )
    repo.issue_auth_token(
        user_id,
        kind,
        phone,
        ttl=webauth.PHONE_CODE_TTL,
        code_hash=digest,
    )
    background.add_task(send_phone_code, phone, code)
    return code


def _verify_phone_code(
    repo: MiniAppRepo,
    settings: WebAuthSettings,
    phone: str,
    code: str,
    kind: str,
) -> int:
    row = repo.latest_phone_code(kind, phone)
    if not row:
        raise HTTPException(status_code=400, detail="code_expired")
    if int(row["attempts"]) >= webauth.PHONE_CODE_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="too_many_attempts")
    expected = webauth.code_hash(code.strip(), settings.jwt_secret, kind=kind, destination=phone)
    if not hmac.compare_digest(expected, row["code_hash"]):
        repo.bump_auth_attempts(row["id"])
        raise HTTPException(status_code=400, detail="invalid_code")
    repo.consume_auth_token_id(row["id"])
    return int(row["id"])


# -- маршруты ---------------------------------------------------------------


def build_webauth_router(
    *,
    repo: MiniAppRepo,
    settings: WebAuthSettings,
    require_user: Callable[..., dict[str, Any]],
    optional_user: Callable[..., dict[str, Any] | None],
) -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["web-auth"])

    @router.get("/session")
    def current_session(
        request: Request,
        response: Response,
        user: dict[str, Any] = Depends(require_user),
    ) -> dict[str, Any]:
        """Кто я: для веб-фронта это замена «прочитать токен из localStorage»."""
        session = getattr(request.state, "web_session", None)
        if not session:
            # Bearer-вход Telegram: cookie-сессии нет, CSRF не нужен.
            return {"user": user, "csrf_token": None}

        csrf = request.cookies.get(webauth.CSRF_COOKIE, "")
        if not csrf or not hmac.compare_digest(
            webauth.token_hash(csrf), session.get("csrf_hash", "")
        ):
            # Cookie потерялась (чистка, смена браузера) — выпускаем новую пару
            # и обновляем привязку в сессии, иначе следующий POST получит 403.
            csrf = webauth.new_token(24)
            repo.rotate_session_csrf(session["session_id"], webauth.token_hash(csrf))
            response.set_cookie(
                webauth.CSRF_COOKIE,
                csrf,
                max_age=settings.session_ttl,
                httponly=False,
                **_cookie_kwargs(request, settings),
            )
        return {"user": user, "csrf_token": csrf}

    @router.post("/register", status_code=201)
    def register(
        payload: RegisterIn,
        request: Request,
        response: Response,
        background: BackgroundTasks,
    ) -> dict[str, Any]:
        _limit(f"register:{_ip(request)}", limit=10, window=3600)
        email = _input(lambda: webauth.normalize_email(payload.email))
        password = _input(lambda: webauth.validate_password(payload.password))
        user = repo.create_web_user(
            email, webauth.hash_password(password), _clean_name(payload.name)
        )
        if not user:
            raise HTTPException(status_code=409, detail="email_taken")

        repo.record_session(user["id"])
        debug_token = _issue_email_verification(repo, background, request, settings, user)
        csrf = _start_session(repo, request, response, settings, user["id"])
        body: dict[str, Any] = {"user": user, "csrf_token": csrf, "verification_sent": True}
        if settings.dev and debug_token:
            body["dev_verification_token"] = debug_token
        return body

    @router.post("/login")
    def login(
        payload: LoginIn,
        request: Request,
        response: Response,
    ) -> dict[str, Any]:
        raw = payload.login.strip()
        login = _input(
            lambda: webauth.normalize_email(raw)
            if webauth.looks_like_email(raw)
            else webauth.normalize_phone(raw)
        )
        _limit(f"login:{login}", limit=10, window=900)
        _limit(f"login-ip:{_ip(request)}", limit=40, window=900)

        user = repo.user_for_login(login)
        stored = user.pop("password_hash", None) if user else None
        if not user or not stored:
            # Считаем scrypt и для несуществующего пользователя: иначе по
            # времени ответа видно, зарегистрирован адрес или нет.
            webauth.verify_password(payload.password, _dummy_hash())
            raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)
        if not webauth.verify_password(payload.password, stored):
            raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)
        if webauth.password_needs_rehash(stored):
            repo.set_password(user["id"], webauth.hash_password(payload.password))

        repo.record_session(user["id"])
        csrf = _start_session(repo, request, response, settings, user["id"])
        return {"user": user, "csrf_token": csrf}

    @router.post("/logout")
    def logout(
        request: Request,
        response: Response,
        user: dict[str, Any] = Depends(require_user),
    ) -> dict[str, Any]:
        session = getattr(request.state, "web_session", None)
        if session:
            repo.revoke_web_session(session["session_id"])
        _clear_session(response)
        return {"ok": True}

    @router.post("/verify-email")
    def verify_email(payload: TokenIn) -> dict[str, Any]:
        digest = webauth.token_hash(payload.token.strip())
        row = repo.consume_auth_token("email_verify", digest)
        kind = "email_verify"
        if not row:
            row = repo.consume_auth_token("email_change", digest)
            kind = "email_change"
        if not row:
            raise HTTPException(status_code=400, detail="invalid_token")

        user_id = int(row["user_id"])
        if kind == "email_change":
            # Ссылка на новую почту: меняем адрес и сразу помечаем его
            # подтверждённым, иначе письмо не имело бы смысла.
            try:
                user = repo.set_email_verified(user_id, row["destination"])
            except pg_errors.UniqueViolation as exc:
                raise HTTPException(status_code=409, detail="email_taken") from exc
        else:
            user = repo.mark_email_verified(user_id, row["destination"])
        if not user:
            raise HTTPException(status_code=400, detail="invalid_token")
        return {"ok": True, "email": user["email"]}

    @router.post("/email/resend")
    def resend_email(
        request: Request,
        background: BackgroundTasks,
        user: dict[str, Any] = Depends(require_user),
    ) -> dict[str, Any]:
        if user.get("email_verified"):
            raise HTTPException(status_code=409, detail="already_verified")
        _limit(f"verify-mail:{user['id']}", limit=3, window=3600)
        token = _issue_email_verification(repo, background, request, settings, user)
        body: dict[str, Any] = {"ok": True}
        if settings.dev and token:
            body["dev_verification_token"] = token
        return body

    @router.post("/password/forgot")
    def forgot_password(
        payload: EmailIn,
        request: Request,
        background: BackgroundTasks,
    ) -> dict[str, Any]:
        _limit(f"forgot-ip:{_ip(request)}", limit=10, window=3600)
        email = _input(lambda: webauth.normalize_email(payload.email))
        _limit(f"forgot:{email}", limit=3, window=900)
        user = repo.get_user_by_email(email)
        body: dict[str, Any] = {"ok": True}
        if user:
            token = webauth.new_token()
            repo.issue_auth_token(
                user["id"],
                "password_reset",
                email,
                ttl=webauth.PASSWORD_TOKEN_TTL,
                token_hash=webauth.token_hash(token),
            )
            link = f"{_public_url(request, settings)}/reset-password?token={quote(token)}"
            background.add_task(send_password_reset_email, email, link)
            # Только в dev: иначе ответ подтверждал бы существование адреса.
            if settings.dev:
                body["dev_reset_token"] = token
        # Для незарегистрированного адреса — тот же ответ без токена.
        return body

    @router.post("/password/reset")
    def reset_password(payload: ResetIn) -> dict[str, Any]:
        password = _input(lambda: webauth.validate_password(payload.password))
        row = repo.consume_auth_token("password_reset", webauth.token_hash(payload.token.strip()))
        if not row:
            raise HTTPException(status_code=400, detail="invalid_token")
        user_id = int(row["user_id"])
        repo.set_password(user_id, webauth.hash_password(password))
        # Смена пароля выкидывает все старые сессии: украденная cookie больше
        # не действует.
        repo.revoke_user_sessions(user_id)
        return {"ok": True}

    @router.post("/phone/start")
    def phone_start(
        payload: PhoneIn,
        request: Request,
        background: BackgroundTasks,
        user: dict[str, Any] = Depends(require_user),
    ) -> dict[str, Any]:
        phone = _input(lambda: webauth.normalize_phone(payload.phone))
        existing = repo.get_user_by_phone(phone)
        if existing and int(existing["id"]) != int(user["id"]):
            raise HTTPException(status_code=409, detail="phone_taken")
        if user.get("phone_verified") and user.get("phone") == phone:
            raise HTTPException(status_code=409, detail="already_verified")
        _limit(f"phone:{phone}", limit=3, window=600)
        _limit(f"phone-user:{user['id']}", limit=10, window=3600)
        code = _issue_phone_code(repo, background, settings, user["id"], phone, "phone_verify")
        body: dict[str, Any] = {"sent": True, "phone": webauth.mask_phone(phone)}
        if settings.dev:
            body["dev_code"] = code
        return body

    @router.post("/phone/verify")
    def phone_verify(
        payload: PhoneVerifyIn,
        user: dict[str, Any] = Depends(require_user),
    ) -> dict[str, Any]:
        phone = _input(lambda: webauth.normalize_phone(payload.phone))
        _verify_phone_code(repo, settings, phone, payload.code, "phone_verify")
        try:
            updated = repo.attach_verified_phone(user["id"], phone)
        except Exception as exc:  # noqa: BLE001 - UniqueViolation приходить из psycopg
            if exc.__class__.__name__ == "UniqueViolation":
                raise HTTPException(status_code=409, detail="phone_taken") from exc
            raise
        if not updated:
            raise HTTPException(status_code=404, detail="user_not_found")
        return {"user": updated}

    @router.post("/phone/login")
    def phone_login(
        payload: PhoneIn,
        request: Request,
        background: BackgroundTasks,
    ) -> dict[str, Any]:
        phone = _input(lambda: webauth.normalize_phone(payload.phone))
        _limit(f"phone-login:{phone}", limit=3, window=600)
        _limit(f"phone-login-ip:{_ip(request)}", limit=20, window=600)
        user = repo.get_user_by_phone(phone)
        body: dict[str, Any] = {"ok": True}
        if user:
            code = _issue_phone_code(repo, background, settings, user["id"], phone, "phone_login")
            if settings.dev:
                body["dev_code"] = code
        # Не подтверждаем, есть ли такой номер: ответ всегда одинаковый.
        return body

    @router.post("/phone/login/verify")
    def phone_login_verify(
        payload: PhoneVerifyIn,
        request: Request,
        response: Response,
    ) -> dict[str, Any]:
        phone = _input(lambda: webauth.normalize_phone(payload.phone))
        _limit(f"phone-login-verify:{_ip(request)}", limit=20, window=600)
        _verify_phone_code(repo, settings, phone, payload.code, "phone_login")
        user = repo.get_user_by_phone(phone)
        if not user:
            raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)
        repo.record_session(user["id"])
        csrf = _start_session(repo, request, response, settings, user["id"])
        return {"user": user, "csrf_token": csrf}

    # -- способы входа и OAuth ---------------------------------------------
    def _error_redirect(request: Request, code: str) -> RedirectResponse:
        return RedirectResponse(
            f"{_public_url(request, settings)}/login?oauth={quote(code)}",
            status_code=302,
        )

    @router.get("/providers")
    def providers() -> dict[str, Any]:
        return {
            "password": True,
            "dev": settings.dev,
            "telegram": {
                "bot_username": settings.bot_username,
                # Виджет требует домен, прописанный у BotFather; без токена
                # бота он всё равно не сможет проверить подпись.
                "widget": bool(settings.bot_token) and settings.telegram_widget,
            },
            "oauth": [
                {"id": name, "label": {"github": "GitHub"}.get(name, name.capitalize())}
                for name in social.enabled()
            ],
        }

    @router.get("/oauth/{provider}/start")
    def oauth_start(
        provider: str,
        request: Request,
        link: str | None = None,
        next: str | None = None,
        user: dict[str, Any] | None = Depends(optional_user),
    ) -> Response:
        if not social.configured(provider):
            return _error_redirect(request, "oauth_unavailable")
        link_mode = (link or "").lower() in {"1", "true", "yes"}
        if link_mode and not user:
            return _error_redirect(request, "oauth_session")

        public = _public_url(request, settings)
        state = webauth.new_token(24)
        config = social.PROVIDERS[provider]
        verifier, challenge = social.new_pkce() if config.pkce else ("", "")
        payload = {
            "p": provider,
            "s": state,
            "v": verifier,
            "n": social.safe_next(next),
            "l": int(user["id"]) if link_mode and user else 0,
            "exp": int(time.time()) + social.STATE_TTL,
        }
        response = RedirectResponse(
            social.authorize_url(
                provider,
                public_url=public,
                state=state,
                code_challenge=challenge or None,
            ),
            status_code=302,
        )
        kwargs = _cookie_kwargs(request, settings)
        kwargs["path"] = "/api/auth/oauth"
        response.set_cookie(
            social.STATE_COOKIE,
            social.sign_state(payload, settings.jwt_secret),
            max_age=social.STATE_TTL,
            httponly=True,
            **kwargs,
        )
        return response

    @router.get("/oauth/{provider}/callback")
    def oauth_callback(
        provider: str,
        request: Request,
        code: str | None = None,
        state: str | None = None,
        error: str | None = None,
        user: dict[str, Any] | None = Depends(optional_user),
    ) -> Response:
        public = _public_url(request, settings)
        raw_state = request.cookies.get(social.STATE_COOKIE, "")
        payload = social.verify_state(raw_state, settings.jwt_secret) if raw_state else None

        def finish(url: str, *, session_for: int | None = None) -> RedirectResponse:
            response = RedirectResponse(url, status_code=302)
            response.delete_cookie(social.STATE_COOKIE, path="/api/auth/oauth")
            if session_for is not None:
                repo.record_session(session_for)
                _start_session(repo, request, response, settings, session_for)
            return response

        if error:
            return finish(f"{public}/login?oauth=denied")
        if not social.configured(provider):
            return finish(f"{public}/login?oauth=oauth_unavailable")
        if (
            not payload
            or payload.get("p") != provider
            or not state
            or not webauth.safe_equal(state, str(payload.get("s", "")))
        ):
            return finish(f"{public}/login?oauth=state")
        if not code:
            return finish(f"{public}/login?oauth=oauth_token_failed")

        try:
            access_token = social.exchange_code(
                provider,
                code=code,
                public_url=public,
                code_verifier=payload.get("v") or None,
            )
            profile = social.fetch_profile(provider, access_token)
        except social.SocialError as exc:
            return finish(f"{public}/login?oauth={quote(exc.code)}")

        link_user_id = int(payload.get("l") or 0)
        if link_user_id:
            # Привязка к уже вошедшему аккаунту: cookie-сессия обязана
            # совпасть с той, для которой выпускали state.
            if not user or int(user["id"]) != link_user_id:
                return finish(f"{public}/login?oauth=oauth_session")
            if not repo.attach_identity(
                link_user_id, provider, profile["subject"], profile["email"]
            ):
                return finish(f"{public}/account?link=exists")
            # Telegram-аккаунт без почты получает её из Google/GitHub:
            # теперь он же может войти паролем после восстановления.
            if profile.get("email_verified"):
                if not user.get("email"):
                    with contextlib.suppress(pg_errors.UniqueViolation):
                        repo.set_email_verified(link_user_id, profile["email"])
                elif (
                    str(user.get("email", "")).lower() == str(profile["email"]).lower()
                    and not user.get("email_verified")
                ):
                    with contextlib.suppress(pg_errors.UniqueViolation):
                        repo.mark_email_verified(link_user_id, profile["email"])
            return finish(f"{public}/account?linked={provider}")

        identity = repo.get_identity(provider, str(profile["subject"]))
        if identity:
            return finish(
                f"{public}{social.safe_next(payload.get('n'))}",
                session_for=int(identity["user"]["id"]),
            )

        email = profile.get("email")
        verified = bool(profile.get("email_verified"))
        if not email:
            return finish(f"{public}/login?oauth=oauth_email_required")

        existing = repo.get_user_by_email(email)
        if existing:
            # Автоматически связываем только подтверждённую провайдером почту.
            if not verified:
                return finish(f"{public}/login?oauth=oauth_email_exists")
            if not repo.attach_identity(
                int(existing["id"]), provider, profile["subject"], email
            ):
                return finish(f"{public}/login?oauth=oauth_link_exists")
            if verified and not existing.get("email_verified"):
                # Google/GitHub подтвердили адрес — снимаем «не подтверждено».
                repo.mark_email_verified(int(existing["id"]), email)
            return finish(
                f"{public}{social.safe_next(payload.get('n'))}",
                session_for=int(existing["id"]),
            )

        created = repo.create_social_user(
            email,
            profile.get("name"),
            email_verified=verified,
        )
        if not created:
            # Гонка двух одновременных входов с одним адресом.
            existing = repo.get_user_by_email(email)
            if not existing or not verified:
                return finish(f"{public}/login?oauth=oauth_email_exists")
            if not repo.attach_identity(
                int(existing["id"]), provider, profile["subject"], email
            ):
                return finish(f"{public}/login?oauth=oauth_link_exists")
            if verified and not existing.get("email_verified"):
                # Google/GitHub подтвердили адрес — снимаем «не подтверждено».
                repo.mark_email_verified(int(existing["id"]), email)
            return finish(
                f"{public}{social.safe_next(payload.get('n'))}",
                session_for=int(existing["id"]),
            )

        if not repo.attach_identity(
            int(created["id"]), provider, profile["subject"], email
        ):
            return finish(f"{public}/login?oauth=oauth_link_exists")
        return finish(
            f"{public}{social.safe_next(payload.get('n'))}",
            session_for=int(created["id"]),
        )

    @router.post("/telegram/web")
    def telegram_web(
        payload: dict[str, Any],
        request: Request,
        response: Response,
    ) -> dict[str, Any]:
        _limit(f"telegram-web:{_ip(request)}", limit=30, window=900)
        if settings.dev and str(payload.get("hash")) == "dev":
            tg = {
                "id": int(os.environ.get("CARCAR_DEV_TG_ID", "1")),
                "username": "dev",
                "first_name": "Dev",
                "last_name": "",
            }
        else:
            if not settings.bot_token:
                raise HTTPException(status_code=503, detail="telegram_unavailable")
            try:
                tg = validate_telegram_login(payload, settings.bot_token)["user"]
            except AuthError as exc:
                raise HTTPException(status_code=401, detail="invalid_telegram") from exc
        user = repo.ensure_user(tg)
        repo.record_session(user["id"])
        csrf = _start_session(repo, request, response, settings, user["id"])
        return {"user": user, "csrf_token": csrf}

    @router.post("/telegram/link/start")
    def telegram_link_start(user: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
        if user.get("tg_id"):
            raise HTTPException(status_code=409, detail="telegram_already_linked")
        _limit(f"telegram-link:{user['id']}", limit=5, window=3600)
        token = webauth.new_token(24)
        repo.issue_auth_token(
            user["id"],
            "telegram_link",
            "telegram",
            ttl=15 * 60,
            token_hash=webauth.token_hash(token),
        )
        return {
            "code": token,
            "command": f"/start link_{token}",
            "deep_link": f"https://t.me/{settings.bot_username}?start=link_{token}",
            "expires_in": 15 * 60,
        }

    @router.get("/identities")
    def identities(user: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
        return {
            "items": repo.list_identities(user["id"]),
            "email": user.get("email"),
            "email_verified": user.get("email_verified"),
            "phone": user.get("phone"),
            "phone_verified": user.get("phone_verified"),
            "has_password": user.get("has_password"),
            "tg_id": user.get("tg_id"),
            "bot_username": settings.bot_username,
        }

    @router.post("/email/start")
    def email_start(
        payload: EmailStartIn,
        request: Request,
        background: BackgroundTasks,
        user: dict[str, Any] = Depends(require_user),
    ) -> dict[str, Any]:
        email = _input(lambda: webauth.normalize_email(payload.email))
        if user.get("email") == email and user.get("email_verified"):
            raise HTTPException(status_code=409, detail="already_verified")
        existing = repo.get_user_by_email(email)
        if existing and int(existing["id"]) != int(user["id"]):
            raise HTTPException(status_code=409, detail="email_taken")
        _limit(f"email-change:{user['id']}", limit=3, window=3600)

        token = webauth.new_token()
        repo.issue_auth_token(
            user["id"],
            "email_change",
            email,
            ttl=webauth.EMAIL_TOKEN_TTL,
            token_hash=webauth.token_hash(token),
        )
        link = f"{_public_url(request, settings)}/verify-email?token={quote(token)}"
        background.add_task(send_verification_email, email, link)
        body: dict[str, Any] = {"sent": True}
        if settings.dev:
            body["dev_token"] = token
        return body

    @router.post("/password/set")
    def password_set(
        payload: PasswordIn,
        user: dict[str, Any] = Depends(require_user),
    ) -> dict[str, Any]:
        if user.get("has_password"):
            raise HTTPException(status_code=409, detail="password_exists")
        if not user.get("email_verified"):
            raise HTTPException(status_code=400, detail="email_not_verified")
        _limit(f"password-set:{user['id']}", limit=5, window=3600)
        password = _input(lambda: webauth.validate_password(payload.password))
        repo.set_password(user["id"], webauth.hash_password(password))
        return {"ok": True}

    return router


__all__ = [
    "WebAuthSettings",
    "build_webauth_router",
    "csrf_ok",
    "LIMITER",
]
