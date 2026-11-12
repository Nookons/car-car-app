"""Авторизация Telegram Mini App.

Схема: клиент присылает `initData` (строка от Telegram), сервер проверяет
подпись HMAC-SHA256 секретом бота и выдаёт свой JWT. Паролей нет.

Проверка подписи:
    secret = HMAC_SHA256("WebAppData", bot_token)
    hash   = HMAC_SHA256(secret, data_check_string)
где data_check_string — отсортированные `key=value`, кроме самого `hash`.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import parse_qsl

TOKEN_TTL = 30 * 24 * 3600
INIT_DATA_TTL = 5 * 60
MAX_FUTURE_AUTH_SKEW = 30
LOGIN_WIDGET_TTL = 5 * 60


class AuthError(ValueError):
    """initData или токен не прошли проверку."""


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def validate_init_data(init_data: str, bot_token: str, *, max_age: int = INIT_DATA_TTL) -> dict:
    """Проверяет подпись Telegram и возвращает поля (user, auth_date, ...)."""
    if not init_data:
        raise AuthError("пустой initData")

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise AuthError("нет подписи")

    check_string = "\n".join(f"{key}={value}" for key, value in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, received_hash):
        raise AuthError("подпись не совпадает")

    try:
        auth_date = int(pairs.get("auth_date", "0") or 0)
    except (TypeError, ValueError) as exc:
        raise AuthError("неверный auth_date") from exc
    if auth_date <= 0:
        raise AuthError("нет auth_date")
    age = time.time() - auth_date
    if age < -MAX_FUTURE_AUTH_SKEW:
        raise AuthError("auth_date из будущего")
    if max_age and age > max_age:
        raise AuthError("initData просрочен")

    user_raw = pairs.get("user")
    if not user_raw:
        raise AuthError("в initData нет user")

    try:
        user = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise AuthError("user не JSON") from exc
    if not user.get("id"):
        raise AuthError("в user нет id")

    return {"user": user, "auth_date": auth_date, "raw": pairs}


def validate_telegram_login(
    payload: dict, bot_token: str, *, max_age: int = LOGIN_WIDGET_TTL
) -> dict:
    """Проверяет данные Telegram Login Widget для обычного браузера.

    Это другой алгоритм, чем у Mini App: секрет — `SHA256(bot_token)`, а не
    `HMAC("WebAppData", bot_token)`. Поля приходят как есть из `data-onauth`,
    поэтому не полагаемся на их типы.
    """
    data = {key: str(value) for key, value in payload.items() if value is not None}
    received_hash = data.pop("hash", "")
    if not received_hash:
        raise AuthError("нет подписи")
    if not bot_token:
        raise AuthError("бот не настроен")

    check_string = "\n".join(f"{key}={value}" for key, value in sorted(data.items()))
    secret = hashlib.sha256(bot_token.encode()).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise AuthError("подпись не совпадает")

    try:
        auth_date = int(data.get("auth_date", "0") or 0)
        user_id = int(data.get("id", "0") or 0)
    except (TypeError, ValueError) as exc:
        raise AuthError("неверные поля Telegram") from exc
    if auth_date <= 0 or user_id <= 0:
        raise AuthError("неверные поля Telegram")
    age = time.time() - auth_date
    if age < -MAX_FUTURE_AUTH_SKEW:
        raise AuthError("auth_date из будущего")
    if max_age and age > max_age:
        raise AuthError("вход просрочен")

    return {
        "user": {
            "id": user_id,
            "first_name": data.get("first_name"),
            "last_name": data.get("last_name"),
            "username": data.get("username"),
            "photo_url": data.get("photo_url"),
            "language_code": data.get("language_code"),
        },
        "auth_date": auth_date,
    }


def issue_token(
    user_id: int, secret: str, *, ttl: int = TOKEN_TTL, auth_version: int = 0
) -> str:
    now = int(time.time())
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = {
        "sub": str(user_id), "iat": now, "exp": now + ttl,
        "ver": max(0, int(auth_version)), "sid": secrets.token_urlsafe(18),
    }
    payload = _b64(json.dumps(body, separators=(",", ":")).encode())
    signature = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64(signature)}"


def verify_token_claims(token: str, secret: str) -> dict:
    """Возвращает проверенные идентификатор и маркеры сессии из JWT."""
    try:
        header, payload, signature = token.split(".")
    except ValueError as exc:
        raise AuthError("битый токен") from exc
    try:
        header_data = json.loads(_unb64(header))
        if header_data.get("alg") != "HS256" or header_data.get("typ") != "JWT":
            raise AuthError("неподдерживаемый заголовок токена")
        expected = hmac.new(
            secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(expected, _unb64(signature)):
            raise AuthError("подпись токена не совпадает")

        data = json.loads(_unb64(payload))
        now = int(time.time())
        if int(data.get("exp", 0)) <= now:
            raise AuthError("токен истёк")
        if int(data.get("iat", 0)) > now + MAX_FUTURE_AUTH_SKEW:
            raise AuthError("токен выпущен в будущем")
        user_id = int(data["sub"])
        if user_id <= 0:
            raise AuthError("неверный пользователь в токене")
        return {
            "user_id": user_id,
            "auth_version": max(0, int(data.get("ver", 0))),
            "session_id": str(data["sid"]) if data.get("sid") else None,
        }
    except AuthError:
        raise
    except (
        AttributeError,
        KeyError,
        TypeError,
        ValueError,
        UnicodeDecodeError,
        binascii.Error,
    ) as exc:
        raise AuthError("битый токен") from exc


def verify_token(token: str, secret: str) -> int:
    """Обратносуместимая проверка JWT, возвращающая user_id."""
    return verify_token_claims(token, secret)["user_id"]
