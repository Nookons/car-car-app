import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest

from carcar.miniapp.auth import (
    AuthError,
    issue_token,
    validate_init_data,
    verify_token,
)

BOT_TOKEN = "123456:TEST-TOKEN"


def make_init_data(
    user_id: int = 42, auth_date: int | None = None, bot_token: str = BOT_TOKEN
) -> str:
    fields = {
        "auth_date": str(auth_date or int(time.time())),
        "user": json.dumps({"id": user_id, "first_name": "Test", "username": "tester"}),
        "query_id": "AAH",
    }
    check = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def test_valid_init_data():
    data = validate_init_data(make_init_data(42), BOT_TOKEN)
    assert data["user"]["id"] == 42
    assert data["user"]["username"] == "tester"


def test_tampered_hash_rejected():
    raw = make_init_data(42).replace("42", "43")
    with pytest.raises(AuthError):
        validate_init_data(raw, BOT_TOKEN)


def test_other_bot_token_rejected():
    with pytest.raises(AuthError):
        validate_init_data(make_init_data(42, bot_token="999:OTHER"), BOT_TOKEN)


def test_expired_init_data_rejected():
    old = int(time.time()) - 2 * 24 * 3600
    with pytest.raises(AuthError):
        validate_init_data(make_init_data(42, auth_date=old), BOT_TOKEN, max_age=3600)


def test_empty_init_data_rejected():
    with pytest.raises(AuthError):
        validate_init_data("", BOT_TOKEN)


def test_token_roundtrip():
    token = issue_token(7, "secret")
    assert verify_token(token, "secret") == 7


def test_token_wrong_secret_rejected():
    token = issue_token(7, "secret")
    with pytest.raises(AuthError):
        verify_token(token, "other-secret")


def test_token_expired_rejected():
    token = issue_token(7, "secret", ttl=-10)
    with pytest.raises(AuthError):
        verify_token(token, "secret")


def test_token_garbage_rejected():
    with pytest.raises(AuthError):
        verify_token("not-a-token", "secret")
