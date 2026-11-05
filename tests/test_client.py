import httpx
import pytest

from carcar.client import BlockedError, Client, FetchError
from carcar.config import Settings


def make_client(handler, **kwargs) -> Client:
    settings = Settings(rps=1000, retries=kwargs.pop("retries", 3), backoff_base=0.001)
    return Client(settings, transport=httpx.MockTransport(handler))


def test_get_returns_text_and_stats():
    def handler(request):
        return httpx.Response(200, text="<html>ok</html>")

    with make_client(handler) as client:
        result = client.get("https://example.test/page")

    assert result.status == 200
    assert result.text == "<html>ok</html>"
    assert client.stats.requests == 1


def test_retries_on_429_then_success():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, text="ok")

    with make_client(handler) as client:
        result = client.get("https://example.test/page")

    assert result.status == 200
    assert calls["n"] == 2
    assert client.stats.retries == 1


def test_403_raises_blocked_without_retry():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(403, text="blocked")

    with make_client(handler) as client, pytest.raises(BlockedError):
        client.get("https://example.test/page")

    assert calls["n"] == 1  # 403 не ретраим — это не временный сбой


def test_persistent_500_raises_fetch_error():
    def handler(request):
        return httpx.Response(500)

    with make_client(handler, retries=2) as client, pytest.raises(FetchError):
        client.get("https://example.test/page")

    assert client.stats.requests == 2


def test_network_error_is_retried():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ConnectError("boom")
        return httpx.Response(200, text="ok")

    with make_client(handler) as client:
        result = client.get("https://example.test/page")

    assert result.status == 200
    assert calls["n"] == 2
