"""OAuth-входы: Google, Facebook, GitHub.

Telegram сюда не входит: у него своя подпись (Mini App initData и Login
Widget). Этот модуль отвечает только за классический OAuth 2.0/OIDC:
authorization code → token → профиль.

Никакого SDK: три HTTP-запроса на вход, поэтому провайдер добавляется
описанием, а не зависимостью. Состояние (state + PKCE + куда вернуть)
подписано HMAC и живёт в короткой httpOnly-cookie — без таблицы в БД.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode

import httpx

STATE_COOKIE = "carcar_oauth"
STATE_TTL = 10 * 60
DEFAULT_NEXT = "/account"


class SocialError(ValueError):
    """Ошибка OAuth с машинным кодом для UI."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Provider:
    name: str
    authorize_url: str
    token_url: str
    scope: str
    pkce: bool = False
    extra_auth: dict[str, str] = field(default_factory=dict)


PROVIDERS: dict[str, Provider] = {
    "google": Provider(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        scope="openid email profile",
        pkce=True,
        extra_auth={"prompt": "select_account", "access_type": "online"},
    ),
    "facebook": Provider(
        name="facebook",
        authorize_url="https://www.facebook.com/v19.0/dialog/oauth",
        token_url="https://graph.facebook.com/v19.0/oauth/access_token",
        scope="email,public_profile",
    ),
    "github": Provider(
        name="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        scope="read:user user:email",
        extra_auth={"allow_signup": "true"},
    ),
}


def client_id(provider: str) -> str:
    return (os.environ.get(f"CARCAR_{provider.upper()}_CLIENT_ID") or "").strip()


def client_secret(provider: str) -> str:
    return (os.environ.get(f"CARCAR_{provider.upper()}_CLIENT_SECRET") or "").strip()


def enabled() -> list[str]:
    return [name for name in PROVIDERS if client_id(name) and client_secret(name)]


def configured(provider: str) -> bool:
    return provider in PROVIDERS and bool(client_id(provider) and client_secret(provider))


def redirect_uri(provider: str, public_url: str) -> str:
    """Один и тот же callback на фронте; Next проксирует его в API."""
    return f"{public_url.rstrip('/')}/api/auth/oauth/{provider}/callback"


# -- состояние в подписанной cookie ----------------------------------------


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def sign_state(payload: dict[str, Any], secret: str) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def verify_state(value: str, secret: str) -> dict[str, Any] | None:
    try:
        body, signature = (value or "").split(".", 1)
    except ValueError:
        return None
    expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None
    try:
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or int(payload.get("exp", 0)) <= int(time.time()):
        return None
    return payload


def new_pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = _b64(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge


def safe_next(value: str | None) -> str:
    """Разрешаем только локальный путь: иначе OAuth станет open redirect."""
    if not value or not value.startswith("/") or value.startswith("//"):
        return DEFAULT_NEXT
    return value[:500]


# -- сеть -------------------------------------------------------------------


def authorize_url(
    provider: str,
    *,
    public_url: str,
    state: str,
    code_challenge: str | None = None,
) -> str:
    config = PROVIDERS[provider]
    params = {
        "client_id": client_id(provider),
        "redirect_uri": redirect_uri(provider, public_url),
        "response_type": "code",
        "scope": config.scope,
        "state": state,
        **config.extra_auth,
    }
    if config.pkce and code_challenge:
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = "S256"
    return f"{config.authorize_url}?{urlencode(params)}"


def exchange_code(
    provider: str,
    *,
    code: str,
    public_url: str,
    code_verifier: str | None,
) -> str:
    config = PROVIDERS[provider]
    data = {
        "client_id": client_id(provider),
        "client_secret": client_secret(provider),
        "code": code,
        "redirect_uri": redirect_uri(provider, public_url),
        "grant_type": "authorization_code",
    }
    if config.pkce and code_verifier:
        data["code_verifier"] = code_verifier

    try:
        with httpx.Client(timeout=20) as client:
            if provider == "facebook":
                response = client.get(config.token_url, params=data)
            else:
                response = client.post(
                    config.token_url,
                    data=data,
                    headers={"Accept": "application/json"},
                )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:  # noqa: BLE001 - наружу отдаём короткий код
        raise SocialError("oauth_token_failed") from exc

    token = payload.get("access_token") if isinstance(payload, dict) else None
    if not token:
        raise SocialError("oauth_token_failed")
    return str(token)


def fetch_profile(provider: str, access_token: str) -> dict[str, Any]:
    """Приводит профили провайдеров к одному виду."""
    if provider == "google":
        return _google_profile(access_token)
    if provider == "facebook":
        return _facebook_profile(access_token)
    if provider == "github":
        return _github_profile(access_token)
    raise SocialError("oauth_unknown_provider")


def _google_profile(access_token: str) -> dict[str, Any]:
    try:
        response = httpx.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:  # noqa: BLE001
        raise SocialError("oauth_profile_failed") from exc
    email = (data.get("email") or "").strip().lower()
    if not data.get("sub") or not email:
        raise SocialError("oauth_email_required")
    return {
        "subject": str(data["sub"]),
        "email": email,
        "email_verified": bool(data.get("email_verified")),
        "name": data.get("name") or data.get("given_name"),
    }


def _facebook_profile(access_token: str) -> dict[str, Any]:
    try:
        response = httpx.get(
            "https://graph.facebook.com/me",
            params={"fields": "id,name,email", "access_token": access_token},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:  # noqa: BLE001
        raise SocialError("oauth_profile_failed") from exc
    email = (data.get("email") or "").strip().lower()
    if not data.get("id") or not email:
        raise SocialError("oauth_email_required")
    # Facebook отдаёт email только подтверждённый, но отдельного флага
    # «verified» в Graph API нет; считаем подтверждённым и не даём
    # автоматически привязываться к чужому аккаунту без email-совпадения.
    return {
        "subject": str(data["id"]),
        "email": email,
        "email_verified": True,
        "name": data.get("name"),
    }


def _github_profile(access_token: str) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    try:
        with httpx.Client(timeout=20) as client:
            user = client.get("https://api.github.com/user", headers=headers)
            user.raise_for_status()
            data = user.json()
            emails = client.get("https://api.github.com/user/emails", headers=headers)
            email_rows = emails.json() if emails.status_code == 200 else []
    except Exception as exc:  # noqa: BLE001
        raise SocialError("oauth_profile_failed") from exc

    primary = next(
        (
            row
            for row in email_rows
            if isinstance(row, dict) and row.get("primary") and row.get("verified")
        ),
        None,
    )
    email = (primary or {}).get("email") or data.get("email") or ""
    email = str(email).strip().lower()
    if not data.get("id") or not email:
        raise SocialError("oauth_email_required")
    return {
        "subject": str(data["id"]),
        "email": email,
        "email_verified": bool(primary),
        "name": data.get("name") or data.get("login"),
    }
