"""Веб-авторизация: хеши, нормализация, rate limit и HTTP-сценарии.

Сценарии идут через настоящий FastAPI-роутер, но с репозиторием в памяти:
база здесь не нужна, а поведение cookie/CSRF проверяется целиком.
"""

from __future__ import annotations

import time
from typing import Any

import pytest
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.testclient import TestClient

from carcar import webauth
from carcar.miniapp.repo import USER_FIELDS
from carcar.miniapp.webauth_routes import (
    LIMITER,
    WebAuthSettings,
    build_webauth_router,
    csrf_ok,
)

# -- чистая логика ----------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  User@Example.COM ", "user@example.com"),
        ("a.b+c@sub.example.pl", "a.b+c@sub.example.pl"),
    ],
)
def test_normalize_email(raw: str, expected: str):
    assert webauth.normalize_email(raw) == expected


@pytest.mark.parametrize("raw", ["", "no-at", "a@b", "a@@b.pl", ".a@b.pl", "a..b@c.pl"])
def test_invalid_email_rejected(raw: str):
    with pytest.raises(webauth.AuthInputError):
        webauth.normalize_email(raw)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("123 456 789", "+48123456789"),
        ("+48 123-456-789", "+48123456789"),
        ("0048123456789", "+48123456789"),
        ("+380 44 123 45 67", "+380441234567"),
    ],
)
def test_normalize_phone(raw: str, expected: str):
    assert webauth.normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["", "abc", "12345", "+48 12", "+01 23456789"])
def test_invalid_phone_rejected(raw: str):
    with pytest.raises(webauth.AuthInputError):
        webauth.normalize_phone(raw)


def test_password_hash_roundtrip_and_salt():
    first = webauth.hash_password("correct horse battery")
    second = webauth.hash_password("correct horse battery")
    assert first != second, "соль должна быть случайной"
    assert webauth.verify_password("correct horse battery", first)
    assert not webauth.verify_password("wrong password", first)
    assert not webauth.verify_password("correct horse battery", "scrypt$bad")


def test_password_rules():
    with pytest.raises(webauth.AuthInputError):
        webauth.validate_password("short")
    with pytest.raises(webauth.AuthInputError):
        webauth.validate_password("password")
    assert webauth.validate_password("длинный пароль 42") == "длинный пароль 42"


def test_password_hash_is_not_rehashed_without_reason():
    stored = webauth.hash_password("correct horse battery")
    assert not webauth.password_needs_rehash(stored)
    # Чужой/старый формат — повод перехешировать при следующем входе.
    assert webauth.password_needs_rehash("bcrypt$whatever")


def test_token_and_code_hash_are_context_bound():
    token = webauth.new_token()
    assert webauth.token_hash(token) == webauth.token_hash(token)
    assert webauth.token_hash(token) != webauth.token_hash(token + "x")

    code = "123456"
    first = webauth.code_hash(code, "secret", kind="phone_verify", destination="+48111")
    second = webauth.code_hash(code, "secret", kind="phone_login", destination="+48111")
    assert first != second


def test_rate_limiter_window():
    now = [100.0]
    limiter = webauth.RateLimiter(clock=lambda: now[0])
    for _ in range(3):
        assert limiter.retry_after("k", 3, 60) is None
    assert limiter.retry_after("k", 3, 60) is not None
    now[0] += 61
    assert limiter.retry_after("k", 3, 60) is None


def test_user_fields_never_expose_password_hash():
    # Хеш не выбирается наружу; от него отдаётся только флаг has_password.
    assert "password_hash," not in USER_FIELDS
    assert "password_hash as" not in USER_FIELDS
    assert "has_password" in USER_FIELDS
    assert "email_verified" in USER_FIELDS


# -- HTTP-сценарии с репозиторием в памяти ---------------------------------


class FakeRepo:
    def __init__(self) -> None:
        self.users: dict[int, dict[str, Any]] = {}
        self.passwords: dict[int, str] = {}
        self.by_email: dict[str, int] = {}
        self.sessions: dict[str, dict[str, Any]] = {}
        self.tokens: list[dict[str, Any]] = []
        self.identities: list[dict[str, Any]] = []
        self.next_user = 1
        self.next_session = 1
        self.next_token = 1
        self.sessions_recorded = 0

    def _public(self, user: dict[str, Any]) -> dict[str, Any]:
        return {key: user.get(key) for key in USER_FIELDS_KEYS}

    def create_web_user(self, email: str, password_hash: str, first_name=None):
        if email in self.by_email:
            return None
        uid = self.next_user
        self.next_user += 1
        user = {
            "id": uid,
            "tg_id": None,
            "username": None,
            "first_name": first_name,
            "last_name": None,
            "email": email,
            "phone": None,
            "email_verified": False,
            "phone_verified": False,
            "has_password": True,
            "lang": "ru",
            "notify_new": True,
            "notify_price": True,
            "digest": False,
            "created_at": "2026-01-01T00:00:00Z",
        }
        self.users[uid] = user
        self.passwords[uid] = password_hash
        self.by_email[email] = uid
        return dict(user)

    def get_user(self, user_id: int):
        user = self.users.get(user_id)
        return dict(user) if user else None

    def ensure_user(self, tg: dict[str, Any]):
        for user in self.users.values():
            if user["tg_id"] == tg["id"]:
                return dict(user)
        uid = self.next_user
        self.next_user += 1
        user = {
            "id": uid,
            "tg_id": tg["id"],
            "username": tg.get("username"),
            "first_name": tg.get("first_name"),
            "last_name": tg.get("last_name"),
            "email": None,
            "phone": None,
            "email_verified": False,
            "phone_verified": False,
            "has_password": False,
            "lang": "ru",
            "notify_new": True,
            "notify_price": True,
            "digest": False,
            "created_at": "2026-01-01T00:00:00Z",
        }
        self.users[uid] = user
        self.identities.append(
            {"user_id": uid, "provider": "telegram", "subject": str(tg["id"]), "email": None}
        )
        return dict(user)

    def get_identity(self, provider: str, subject: str):
        for identity in self.identities:
            if identity["provider"] == provider and identity["subject"] == subject:
                return {
                    "provider": provider,
                    "subject": subject,
                    "email": identity.get("email"),
                    "user": dict(self.users[identity["user_id"]]),
                }
        return None

    def list_identities(self, user_id: int):
        return [
            {
                "provider": item["provider"],
                "email": item.get("email"),
                "created_at": "2026-01-01T00:00:00Z",
                "last_login_at": "2026-01-01T00:00:00Z",
            }
            for item in self.identities
            if item["user_id"] == user_id
        ]

    def attach_identity(self, user_id, provider, subject, email=None):
        for identity in self.identities:
            if identity["provider"] == provider and identity["subject"] == subject:
                return identity["user_id"] == user_id
        self.identities.append(
            {"user_id": user_id, "provider": provider, "subject": subject, "email": email}
        )
        return True

    def create_social_user(self, email, first_name=None, *, email_verified):
        if email.lower() in self.by_email:
            return None
        uid = self.next_user
        self.next_user += 1
        user = {
            "id": uid,
            "tg_id": None,
            "username": None,
            "first_name": first_name,
            "last_name": None,
            "email": email.lower(),
            "phone": None,
            "email_verified": email_verified,
            "phone_verified": False,
            "has_password": False,
            "lang": "ru",
            "notify_new": True,
            "notify_price": True,
            "digest": False,
            "created_at": "2026-01-01T00:00:00Z",
        }
        self.users[uid] = user
        self.by_email[email.lower()] = uid
        return dict(user)

    def set_email_verified(self, user_id, email):
        if email.lower() in self.by_email and self.by_email[email.lower()] != user_id:
            from psycopg.errors import UniqueViolation

            raise UniqueViolation("email_taken")
        self.users[user_id]["email"] = email.lower()
        self.users[user_id]["email_verified"] = True
        self.by_email[email.lower()] = user_id
        return dict(self.users[user_id])

    def get_user_by_tg(self, tg_id):
        for user in self.users.values():
            if user["tg_id"] == tg_id:
                return dict(user)
        return None

    def link_telegram(self, user_id, tg):
        for user in self.users.values():
            if user["tg_id"] == tg["id"] and user["id"] != user_id:
                return None
        self.users[user_id]["tg_id"] = tg["id"]
        self.users[user_id]["username"] = self.users[user_id]["username"] or tg.get("username")
        self.attach_identity(user_id, "telegram", str(tg["id"]))
        return dict(self.users[user_id])

    def user_for_login(self, login: str):
        uid = self.by_email.get(login.lower())
        if uid is None:
            return None
        user = dict(self.users[uid])
        user["password_hash"] = self.passwords[uid]
        return user

    def get_user_by_email(self, email: str):
        uid = self.by_email.get(email.lower())
        return dict(self.users[uid]) if uid else None

    def get_user_by_phone(self, phone: str):
        for user in self.users.values():
            if user["phone"] == phone and user["phone_verified"]:
                return dict(user)
        return None

    def record_session(self, user_id: int):
        self.sessions_recorded += 1

    def issue_auth_token(
        self,
        user_id: int,
        kind: str,
        destination: str,
        *,
        ttl: int,
        token_hash=None,
        code_hash=None,
    ):
        for token in self.tokens:
            if (
                token["user_id"] == user_id
                and token["kind"] == kind
                and token["destination"] == destination
                and token["consumed_at"] is None
            ):
                token["consumed_at"] = time.time()
        token = {
            "id": self.next_token,
            "user_id": user_id,
            "kind": kind,
            "destination": destination,
            "token_hash": token_hash,
            "code_hash": code_hash,
            "attempts": 0,
            "expires_at": time.time() + ttl,
            "consumed_at": None,
        }
        self.next_token += 1
        self.tokens.append(token)
        return token["id"]

    def consume_auth_token(self, kind: str, token_hash: str):
        for token in self.tokens:
            if (
                token["kind"] == kind
                and token["token_hash"] == token_hash
                and token["consumed_at"] is None
                and token["expires_at"] > time.time()
            ):
                token["consumed_at"] = time.time()
                return {"user_id": token["user_id"], "destination": token["destination"]}
        return None

    def mark_email_verified(self, user_id: int, email: str):
        self.users[user_id]["email_verified"] = True
        return dict(self.users[user_id])

    def set_password(self, user_id: int, password_hash: str):
        self.passwords[user_id] = password_hash
        self.users[user_id]["has_password"] = True

    def create_web_session(
        self, user_id: int, token_hash: str, csrf_hash: str, *, ttl: int, user_agent=None
    ):
        sid = self.next_session
        self.next_session += 1
        self.sessions[token_hash] = {
            "session_id": sid,
            "user_id": user_id,
            "csrf_hash": csrf_hash,
            "expires_at": time.time() + ttl,
        }
        return sid

    def get_web_session(self, token_hash: str):
        item = self.sessions.get(token_hash)
        if not item or item["expires_at"] <= time.time():
            return None
        return {
            "session_id": item["session_id"],
            "csrf_hash": item["csrf_hash"],
            "expires_at": item["expires_at"],
            "user": dict(self.users[item["user_id"]]),
        }

    def rotate_session_csrf(self, session_id: int, csrf_hash: str):
        for item in self.sessions.values():
            if item["session_id"] == session_id:
                item["csrf_hash"] = csrf_hash

    def revoke_web_session(self, session_id: int):
        for key, item in list(self.sessions.items()):
            if item["session_id"] == session_id:
                self.sessions.pop(key)

    def revoke_user_sessions(self, user_id: int, *, except_id=None):
        for key, item in list(self.sessions.items()):
            if item["user_id"] == user_id and item["session_id"] != except_id:
                self.sessions.pop(key)

    def latest_phone_code(self, kind: str, destination: str):
        for token in reversed(self.tokens):
            if (
                token["kind"] == kind
                and token["destination"] == destination
                and token["consumed_at"] is None
                and token["expires_at"] > time.time()
            ):
                return dict(token)
        return None

    def bump_auth_attempts(self, token_id: int):
        for token in self.tokens:
            if token["id"] == token_id:
                token["attempts"] += 1

    def consume_auth_token_id(self, token_id: int):
        for token in self.tokens:
            if token["id"] == token_id:
                token["consumed_at"] = time.time()

    def attach_verified_phone(self, user_id: int, phone: str):
        self.users[user_id]["phone"] = phone
        self.users[user_id]["phone_verified"] = True
        return dict(self.users[user_id])


USER_FIELDS_KEYS = (
    "id",
    "tg_id",
    "username",
    "first_name",
    "last_name",
    "email",
    "phone",
    "email_verified",
    "phone_verified",
    "has_password",
    "lang",
    "notify_new",
    "notify_price",
    "digest",
    "created_at",
)


@pytest.fixture()
def client():
    LIMITER.reset()
    repo = FakeRepo()

    def require_user(request: Request, authorization: str | None = Header(default=None)):
        raw = request.cookies.get(webauth.SESSION_COOKIE)
        if not raw:
            raise HTTPException(status_code=401, detail="нет токена")
        session = repo.get_web_session(webauth.token_hash(raw))
        if not session:
            raise HTTPException(status_code=401, detail="нет токена")
        request.state.web_session = session
        if request.method not in ("GET", "HEAD", "OPTIONS") and not csrf_ok(request, session):
            raise HTTPException(status_code=403, detail="csrf_failed")
        return session["user"]

    def optional_user(request: Request, authorization: str | None = Header(default=None)):
        raw = request.cookies.get(webauth.SESSION_COOKIE)
        if not raw:
            return None
        session = repo.get_web_session(webauth.token_hash(raw))
        if not session:
            return None
        request.state.web_session = session
        return session["user"]

    app = FastAPI()
    app.include_router(
        build_webauth_router(
            repo=repo,  # type: ignore[arg-type]
            settings=WebAuthSettings(
                public_url="https://carcar.test",
                jwt_secret="test-secret",
                dev=True,
                cookie_secure=False,
                cookie_samesite="lax",
                bot_token="123456:TEST-TOKEN",
            ),
            require_user=require_user,
            optional_user=optional_user,
        )
    )
    with TestClient(app) as test_client:
        yield test_client, repo


def csrf(client: TestClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("carcar_csrf") or ""}


def test_register_creates_session_and_verification(client):
    http, repo = client
    response = http.post(
        "/api/auth/register",
        json={"email": "User@Example.com", "password": "correct horse 42", "name": "Ann"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "user@example.com"
    assert body["user"]["has_password"] is True
    assert "password_hash" not in body["user"]
    assert body["verification_sent"] is True
    assert body["dev_verification_token"]
    assert webauth.SESSION_COOKIE in http.cookies
    assert webauth.CSRF_COOKIE in http.cookies
    assert repo.sessions_recorded == 1
    # Пароль в репозитории — только scrypt, наружу хеш не отдаётся.
    assert repo.passwords[body["user"]["id"]].startswith("scrypt$")
    set_cookies = response.headers.get_list("set-cookie")
    session_cookie = next(c for c in set_cookies if c.startswith("carcar_session="))
    csrf_cookie = next(c for c in set_cookies if c.startswith("carcar_csrf="))
    assert "HttpOnly" in session_cookie
    assert "SameSite=lax" in session_cookie
    assert "HttpOnly" not in csrf_cookie

    # Токен из письма действительно подтверждает почту.
    verified = http.post(
        "/api/auth/verify-email", json={"token": body["dev_verification_token"]}
    )
    assert verified.status_code == 200
    assert repo.users[body["user"]["id"]]["email_verified"] is True


def test_duplicate_email_rejected(client):
    http, _ = client
    payload = {"email": "same@example.com", "password": "correct horse 42"}
    assert http.post("/api/auth/register", json=payload).status_code == 201
    http.cookies.clear()
    assert http.post("/api/auth/register", json=payload).status_code == 409


def test_mutating_cookie_request_requires_csrf(client):
    http, _ = client
    http.post(
        "/api/auth/register",
        json={"email": "csrf@example.com", "password": "correct horse 42"},
    )
    assert http.post("/api/auth/logout").status_code == 403
    assert http.post("/api/auth/logout", headers=csrf(http)).status_code == 200
    assert http.get("/api/auth/session").status_code == 401


def test_login_wrong_password_and_success(client):
    http, repo = client
    http.post(
        "/api/auth/register",
        json={"email": "login@example.com", "password": "correct horse 42"},
    )
    http.cookies.clear()

    wrong = http.post(
        "/api/auth/login",
        json={"login": "login@example.com", "password": "not the password"},
    )
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "invalid_credentials"

    ok = http.post(
        "/api/auth/login",
        json={"login": "LOGIN@example.com", "password": "correct horse 42"},
    )
    assert ok.status_code == 200
    assert ok.json()["user"]["email"] == "login@example.com"
    assert http.get("/api/auth/session").status_code == 200


def test_phone_verification_flow(client):
    http, repo = client
    http.post(
        "/api/auth/register",
        json={"email": "phone@example.com", "password": "correct horse 42"},
    )

    started = http.post(
        "/api/auth/phone/start",
        json={"phone": "123 456 789"},
        headers=csrf(http),
    )
    assert started.status_code == 200
    assert started.json()["phone"].startswith("+48")
    code = started.json()["dev_code"]

    verified = http.post(
        "/api/auth/phone/verify",
        json={"phone": "+48123456789", "code": code},
        headers=csrf(http),
    )
    assert verified.status_code == 200
    assert verified.json()["user"]["phone"] == "+48123456789"
    assert verified.json()["user"]["phone_verified"] is True
    assert any(user["phone"] for user in repo.users.values())


def test_wrong_phone_code_counts_attempts(client):
    http, repo = client
    http.post(
        "/api/auth/register",
        json={"email": "code@example.com", "password": "correct horse 42"},
    )
    http.post(
        "/api/auth/phone/start",
        json={"phone": "+48111222333"},
        headers=csrf(http),
    )
    bad = http.post(
        "/api/auth/phone/verify",
        json={"phone": "+48111222333", "code": "000000"},
        headers=csrf(http),
    )
    assert bad.status_code == 400
    assert bad.json()["detail"] == "invalid_code"
    assert any(token["attempts"] == 1 for token in repo.tokens)


def test_rate_limit_blocks_password_bruteforce(client):
    http, _ = client
    http.post(
        "/api/auth/register",
        json={"email": "limit@example.com", "password": "correct horse 42"},
    )
    http.cookies.clear()
    for _ in range(10):
        http.post(
            "/api/auth/login",
            json={"login": "limit@example.com", "password": "wrong password"},
        )
    blocked = http.post(
        "/api/auth/login",
        json={"login": "limit@example.com", "password": "correct horse 42"},
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "rate_limited"


def test_schema_and_migration_both_contain_web_auth():
    """Схема для новой базы и миграция для живой не должны разойтись."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    schema = (root / "carcar" / "schema.sql").read_text(encoding="utf-8")
    migration = (root / "db" / "migrations" / "20261112_web_auth.sql").read_text(
        encoding="utf-8"
    )
    for needle in (
        "web_session",
        "auth_token",
        "password_hash",
        "email_verified_at",
        "phone_verified_at",
        "alter column tg_id drop not null",
    ):
        assert needle in schema, f"schema.sql: нет {needle}"
        assert needle in migration, f"миграция: нет {needle}"


def test_password_reset_revokes_and_changes_password(client):
    http, repo = client
    http.post(
        "/api/auth/register",
        json={"email": "reset@example.com", "password": "correct horse 42"},
    )
    forgot = http.post("/api/auth/password/forgot", json={"email": "reset@example.com"})
    assert forgot.status_code == 200
    token = forgot.json()["dev_reset_token"]

    http.cookies.clear()
    reset = http.post(
        "/api/auth/password/reset",
        json={"token": token, "password": "brand new password 7"},
    )
    assert reset.status_code == 200
    assert repo.sessions == {}  # все сессии отозваны

    old = http.post(
        "/api/auth/login",
        json={"login": "reset@example.com", "password": "correct horse 42"},
    )
    assert old.status_code == 401
    new = http.post(
        "/api/auth/login",
        json={"login": "reset@example.com", "password": "brand new password 7"},
    )
    assert new.status_code == 200


def _widget_hash(payload: dict[str, Any], bot_token: str) -> str:
    import hashlib
    import hmac as hmac_lib

    fields = {key: str(value) for key, value in payload.items() if key != "hash"}
    check = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hashlib.sha256(bot_token.encode()).digest()
    return hmac_lib.new(secret, check.encode(), hashlib.sha256).hexdigest()


def test_telegram_login_widget_signature():
    from carcar.miniapp.auth import AuthError, validate_telegram_login

    token = "123456:TEST-TOKEN"
    payload = {
        "id": 42,
        "first_name": "Ann",
        "username": "ann",
        "auth_date": int(time.time()),
    }
    payload["hash"] = _widget_hash(payload, token)
    result = validate_telegram_login(payload, token)
    assert result["user"]["id"] == 42
    assert result["user"]["username"] == "ann"

    tampered = dict(payload, first_name="Bob")
    with pytest.raises(AuthError):
        validate_telegram_login(tampered, token)

    old = dict(payload, auth_date=int(time.time()) - 3600)
    old["hash"] = _widget_hash(old, token)
    with pytest.raises(AuthError):
        validate_telegram_login(old, token)


def test_oauth_state_is_signed_and_expires():
    from carcar.miniapp import social

    payload = {"p": "google", "s": "state", "l": 0, "exp": int(time.time()) + 60}
    value = social.sign_state(payload, "secret")
    assert social.verify_state(value, "secret") == payload
    assert social.verify_state(value, "other") is None
    replacement = "0" if value[-2] != "0" else "1"
    assert social.verify_state(value[:-2] + replacement + value[-1], "secret") is None
    assert social.verify_state(social.sign_state({**payload, "exp": 1}, "secret"), "secret") is None
    assert social.safe_next("https://evil.example") == "/account"
    assert social.safe_next("//evil.example") == "/account"
    assert social.safe_next("/listing/1") == "/listing/1"


def test_providers_and_identities(client):
    http, _ = client
    providers = http.get("/api/auth/providers")
    assert providers.status_code == 200
    assert providers.json()["telegram"]["bot_username"] == "CarCarFinderBot"
    assert providers.json()["oauth"] == []

    http.post(
        "/api/auth/register",
        json={"email": "ident@example.com", "password": "correct horse 42"},
    )
    identities = http.get("/api/auth/identities")
    assert identities.status_code == 200
    assert identities.json()["email"] == "ident@example.com"
    assert identities.json()["has_password"] is True

    started = http.post("/api/auth/telegram/link/start", headers=csrf(http))
    assert started.status_code == 200
    assert started.json()["deep_link"].startswith("https://t.me/CarCarFinderBot?start=link_")


def test_telegram_web_login_and_email_password_link(client):
    http, repo = client
    logged = http.post("/api/auth/telegram/web", json={"hash": "dev", "id": 1})
    assert logged.status_code == 200
    user = logged.json()["user"]
    assert user["tg_id"] == 1
    # Веб-вход отдаёт cookie, а не JWT.
    assert "token" not in logged.json()
    assert http.cookies.get("carcar_session")

    started = http.post(
        "/api/auth/email/start",
        json={"email": "tg@example.com"},
        headers=csrf(http),
    )
    assert started.status_code == 200
    dev_token = started.json()["dev_token"]
    verified = http.post("/api/auth/verify-email", json={"token": dev_token})
    assert verified.status_code == 200
    assert repo.users[user["id"]]["email"] == "tg@example.com"

    http.cookies.clear()


def test_email_change_requires_csrf_and_password_set(client):
    http, repo = client
    logged = http.post("/api/auth/telegram/web", json={"hash": "dev"})
    assert logged.status_code == 200
    user_id = logged.json()["user"]["id"]

    # Без CSRF менять почту нельзя.
    assert http.post("/api/auth/email/start", json={"email": "x@example.com"}).status_code == 403
    started = http.post(
        "/api/auth/email/start",
        json={"email": "linked@example.com"},
        headers=csrf(http),
    )
    assert started.status_code == 200
    token = started.json()["dev_token"]
    assert http.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    assert repo.users[user_id]["email_verified"] is True

    # Пароль ставится на тот же аккаунт; после этого работает вход по почте.
    assert http.post(
        "/api/auth/password/set",
        json={"password": "brand new password 7"},
        headers=csrf(http),
    ).status_code == 200
    http.cookies.clear()
    login = http.post(
        "/api/auth/login",
        json={"login": "linked@example.com", "password": "brand new password 7"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["id"] == user_id


def test_oauth_callback_creates_and_links_google(client, monkeypatch):
    from urllib.parse import parse_qs, urlparse

    from carcar.miniapp import social

    monkeypatch.setenv("CARCAR_GOOGLE_CLIENT_ID", "google-client")
    monkeypatch.setenv("CARCAR_GOOGLE_CLIENT_SECRET", "google-secret")
    monkeypatch.setattr(
        social,
        "exchange_code",
        lambda provider, *, code, public_url, code_verifier: "access-token",
    )
    monkeypatch.setattr(
        social,
        "fetch_profile",
        lambda provider, token: {
            "subject": "google-sub",
            "email": "oauth@example.com",
            "email_verified": True,
            "name": "OAuth User",
        },
    )

    http, repo = client
    started = http.get(
        "/api/auth/oauth/google/start?next=/account", follow_redirects=False
    )
    assert started.status_code == 302
    state = parse_qs(urlparse(started.headers["location"]).query)["state"][0]
    callback = http.get(
        f"/api/auth/oauth/google/callback?code=abc&state={state}",
        follow_redirects=False,
    )
    assert callback.status_code == 302
    assert callback.headers["location"].endswith("/account")
    session = http.get("/api/auth/session")
    assert session.status_code == 200
    assert session.json()["user"]["email"] == "oauth@example.com"
    assert repo.identities[-1]["provider"] == "google"

    # Привязка Google к уже существующему аккаунту не создаёт второго.
    monkeypatch.setattr(
        social,
        "fetch_profile",
        lambda provider, token: {
            "subject": "google-sub-link",
            "email": "linked-google@example.com",
            "email_verified": True,
            "name": "Linked Google",
        },
    )
    http.post(
        "/api/auth/register",
        json={"email": "link@example.com", "password": "correct horse 42"},
    )
    before = http.get("/api/auth/session").json()["user"]["id"]
    started = http.get(
        "/api/auth/oauth/google/start?link=1&next=/account", follow_redirects=False
    )
    state = parse_qs(urlparse(started.headers["location"]).query)["state"][0]
    callback = http.get(
        f"/api/auth/oauth/google/callback?code=abc&state={state}",
        follow_redirects=False,
    )
    assert callback.status_code == 302
    assert "linked=google" in callback.headers["location"]
    after = http.get("/api/auth/session").json()["user"]["id"]
    assert after == before


def test_social_schema_and_migration_agree():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    schema = (root / "carcar" / "schema.sql").read_text(encoding="utf-8")
    migration = (root / "db" / "migrations" / "20261112_social_auth.sql").read_text(
        encoding="utf-8"
    )
    for needle in ("user_identity", "telegram_link", "email_change", "provider", "subject"):
        assert needle in schema, f"schema.sql: нет {needle}"
        assert needle in migration, f"миграция: нет {needle}"


def test_plan2027_schema_and_migration_agree():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    schema = (root / "carcar" / "schema.sql").read_text(encoding="utf-8")
    migration = (
        root / "db" / "migrations" / "20261112_plan2027_funnel_shortlist.sql"
    ).read_text(encoding="utf-8")
    for needle in (
        "funnel_event",
        "favorite_status_check",
        "status text not null default 'shortlist'",
        "delete from funnel_event",
    ):
        assert needle in schema, f"schema.sql: нет {needle}"
        assert needle in migration, f"миграция: нет {needle}"
