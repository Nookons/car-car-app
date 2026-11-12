"""Веб-авторизация: пароли, cookie-сессии, подтверждение почты и телефона.

Telegram Mini App живёт отдельно: `carcar.miniapp.auth` проверяет `initData`
и выдаёт JWT, и этот путь не меняется. Здесь — второй, самостоятельный вход
для обычного браузера:

* пароль хранится только как scrypt-хеш (stdlib, без внешних зависимостей);
* сессия — случайный токен в httpOnly-cookie, в БД лежит только SHA-256;
* e-mail подтверждается ссылкой, телефон — шестизначным кодом;
* всё, что можно перебрать (коды, пароли, письма), ограничено rate limit'ом.

Модуль намеренно не знает ни про FastAPI, ни про Postgres: его можно
проверять тестами без базы и без сети.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import re
import secrets
import threading
import time
from collections import deque
from collections.abc import Callable

SESSION_COOKIE = "carcar_session"
CSRF_COOKIE = "carcar_csrf"

PASSWORD_MIN = 8
PASSWORD_MAX = 128

# OWASP: scrypt N=2^15 (32 МиБ), r=8, p=1 — минимум для интерактивного входа.
# Больше N на каждую попытку входа выделяет больше памяти, поэтому потолок
# ограничен и при проверке: испорченная строка в БД не должна ронять процесс.
SCRYPT_N = 1 << 15
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
SCRYPT_MAXMEM = 64 * 1024 * 1024
_SCRYPT_LIMITS = {"n": 1 << 18, "r": 16, "p": 4}

SESSION_TTL = 30 * 24 * 3600
EMAIL_TOKEN_TTL = 24 * 3600
PASSWORD_TOKEN_TTL = 3600
PHONE_CODE_TTL = 10 * 60
PHONE_CODE_MAX_ATTEMPTS = 5

# Совсем короткие и самые частые пароли. Полный список утечек здесь не нужен:
# он стоил бы мегабайт и устаревал; длина 8+ и этот короткий стоп-лист
# отсекают то, что подбирают в первую очередь.
_COMMON_PASSWORDS = {
    "12345678",
    "123456789",
    "1234567890",
    "password",
    "password1",
    "password123",
    "qwerty123",
    "qwertyui",
    "iloveyou",
    "admin123",
    "letmein1",
    "welcome1",
    "abc12345",
    "11111111",
    "00000000",
}

_EMAIL_RE = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)


class AuthInputError(ValueError):
    """Ввод не прошёл проверку. `code` — стабильный машинный код для UI."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


# -- пароли -----------------------------------------------------------------


def validate_password(password: str) -> str:
    """Возвращает пароль как есть или бросает `AuthInputError`."""
    if not isinstance(password, str):
        raise AuthInputError("weak_password")
    if len(password) < PASSWORD_MIN:
        raise AuthInputError("weak_password")
    if len(password) > PASSWORD_MAX:
        raise AuthInputError("password_too_long")
    if password.lower() in _COMMON_PASSWORDS:
        raise AuthInputError("weak_password")
    if not password.strip():
        raise AuthInputError("weak_password")
    return password


def hash_password(password: str) -> str:
    """scrypt-хеш в самодостаточном формате: `scrypt$N$r$p$salt$hash`."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
        maxmem=SCRYPT_MAXMEM,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def _parse_password_hash(stored: str) -> tuple[int, int, int, bytes, bytes] | None:
    parts = (stored or "").split("$")
    if len(parts) != 6 or parts[0] != "scrypt":
        return None
    try:
        n, r, p = int(parts[1]), int(parts[2]), int(parts[3])
        salt, digest = _unb64(parts[4]), _unb64(parts[5])
    except (TypeError, ValueError, binascii.Error):
        return None
    if not (1 < n <= _SCRYPT_LIMITS["n"]) or n & (n - 1):
        return None
    if not (1 <= r <= _SCRYPT_LIMITS["r"]) or not (1 <= p <= _SCRYPT_LIMITS["p"]):
        return None
    if not 8 <= len(salt) <= 64 or not 16 <= len(digest) <= 64:
        return None
    return n, r, p, salt, digest


def verify_password(password: str, stored: str) -> bool:
    parsed = _parse_password_hash(stored)
    if parsed is None:
        return False
    n, r, p, salt, digest = parsed
    try:
        candidate = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(digest),
            maxmem=SCRYPT_MAXMEM,
        )
    except (ValueError, MemoryError):
        return False
    return hmac.compare_digest(candidate, digest)


def password_needs_rehash(stored: str) -> bool:
    parsed = _parse_password_hash(stored)
    if parsed is None:
        return True
    return parsed[:3] != (SCRYPT_N, SCRYPT_R, SCRYPT_P)


# -- e-mail и телефон -------------------------------------------------------


def normalize_email(value: str) -> str:
    email = (value or "").strip()
    if len(email) < 5 or len(email) > 254 or email.count("@") != 1:
        raise AuthInputError("invalid_email")
    local, domain = email.rsplit("@", 1)
    if len(local) > 64 or ".." in local or local.startswith(".") or local.endswith("."):
        raise AuthInputError("invalid_email")
    email = f"{local}@{domain}".lower()
    if not _EMAIL_RE.fullmatch(email):
        raise AuthInputError("invalid_email")
    return email


def normalize_phone(value: str) -> str:
    """Приводит номер к E.164.

    Польский номер без префикса (`123 456 789`) получает `+48`: продукт
    польский, и это тот случай, когда человек не думает о коде страны.
    Остальные номера принимаются только с `+` или `00`.
    """
    raw = (value or "").strip()
    if not raw:
        raise AuthInputError("invalid_phone")
    cleaned = re.sub(r"[\s\-()./]", "", raw)
    if cleaned.startswith("00"):
        cleaned = f"+{cleaned[2:]}"

    has_plus = cleaned.startswith("+")
    digits = cleaned[1:] if has_plus else cleaned
    if not digits.isdigit():
        raise AuthInputError("invalid_phone")

    if not has_plus:
        if len(digits) == 9:
            digits = f"48{digits}"
        elif len(digits) == 11 and digits.startswith("48"):
            pass
        else:
            raise AuthInputError("invalid_phone")

    if not 8 <= len(digits) <= 15:
        raise AuthInputError("invalid_phone")
    if digits.startswith("0"):
        raise AuthInputError("invalid_phone")
    return f"+{digits}"


def looks_like_email(value: str) -> bool:
    return "@" in (value or "")


def mask_email(email: str) -> str:
    try:
        local, domain = email.split("@", 1)
    except ValueError:
        return email
    if len(local) <= 2:
        return f"{local[0]}***@{domain}" if local else email
    return f"{local[:2]}***@{domain}"


def mask_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) < 4:
        return phone
    return f"+{digits[:-4]}***{digits[-4:]}"


# -- токены и коды ----------------------------------------------------------


def new_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def new_code() -> str:
    """Шестизначный код, всегда с ведущими нулями."""
    return f"{secrets.randbelow(1_000_000):06d}"


def token_hash(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def code_hash(code: str, secret: str, *, kind: str, destination: str) -> str:
    """HMAC, а не голый SHA-256: у шестизначного кода всего 10^6 вариантов."""
    if not secret:
        raise ValueError("для кода нужен секрет")
    message = f"{kind}:{destination}:{code}".encode()
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def safe_equal(left: str, right: str) -> bool:
    return hmac.compare_digest((left or "").encode(), (right or "").encode())


# -- ограничение частоты ----------------------------------------------------


class RateLimiter:
    """Скользящее окно в памяти процесса.

    Один инстанс API — этого достаточно; при горизонтальном масштабировании
    счётчики нужно перенести в Redis (там уже живёт кэш). Ключ включает
    действие и идентификатор, поэтому лимит на e-mail не расходуется
    попытками с другого адреса.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def retry_after(self, key: str, limit: int, window: float) -> int | None:
        """None — можно; иначе через сколько секунд повторить."""
        now = self._clock()
        cutoff = now - window
        with self._lock:
            bucket = self._events.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                return max(1, int(window - (now - bucket[0])) + 1)
            bucket.append(now)
            if len(self._events) > 20_000:
                self._prune(cutoff)
        return None

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._events.clear()
            else:
                self._events.pop(key, None)

    def _prune(self, cutoff: float) -> None:
        empty = [
            name
            for name, bucket in self._events.items()
            if not bucket or bucket[-1] <= cutoff
        ]
        for name in empty:
            self._events.pop(name, None)
