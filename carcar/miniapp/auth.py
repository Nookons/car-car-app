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
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

TOKEN_TTL = 30 * 24 * 3600
INIT_DATA_TTL = 24 * 3600


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

    auth_date = int(pairs.get("auth_date", "0") or 0)
    if max_age and auth_date and time.time() - auth_date > max_age:
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


def issue_token(user_id: int, secret: str, *, ttl: int = TOKEN_TTL) -> str:
    now = int(time.time())
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = {"sub": str(user_id), "iat": now, "exp": now + ttl}
    payload = _b64(json.dumps(body, separators=(",", ":")).encode())
    signature = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64(signature)}"


def verify_token(token: str, secret: str) -> int:
    """Возвращает user_id из подписанного токена."""
    try:
        header, payload, signature = token.split(".")
    except ValueError as exc:
        raise AuthError("битый токен") from exc

    expected = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _unb64(signature)):
        raise AuthError("подпись токена не совпадает")

    data = json.loads(_unb64(payload))
    if int(data.get("exp", 0)) < time.time():
        raise AuthError("токен истёк")
    return int(data["sub"])
