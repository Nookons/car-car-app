#!/usr/bin/env python3
"""Генерация тестовых фикстур из живой страницы otomoto.

Фикстуры нужны, чтобы тесты парсера работали без сети и ловили изменение
вёрстки: если структура поменяется, тест упадёт, а не прод молча.

    .venv/bin/python scripts/make_fixtures.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from carcar.client import Client  # noqa: E402
from carcar.config import Settings  # noqa: E402
from carcar.parse import extract_next_data  # noqa: E402

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures"


def trim_search(data: dict) -> dict:
    page = data["props"]["pageProps"]
    state = page["urqlState"]
    keep = {}
    for key, value in state.items():
        payload = json.loads(value["data"]) if isinstance(value["data"], str) else value["data"]
        if isinstance(payload, dict) and "advertSearch" in payload:
            search = payload["advertSearch"]
            search["edges"] = search["edges"][:3]
            keep[key] = {"data": json.dumps(payload, ensure_ascii=False)}
    return {"props": {"pageProps": {"urqlState": keep}}}


def trim_offer(data: dict) -> dict:
    advert = data["props"]["pageProps"]["advert"]
    advert = {
        "id": advert["id"],
        "url": advert["url"],
        "title": advert["title"],
        "description": (advert.get("description") or "")[:400],
        "createdAt": advert.get("createdAt"),
        "updatedAt": advert.get("updatedAt"),
        "price": advert.get("price"),
        "details": advert.get("details"),
        "images": {"photos": (advert.get("images", {}).get("photos") or [])[:2]},
        "seller": {
            "type": advert.get("seller", {}).get("type"),
            "name": advert.get("seller", {}).get("name"),
        },
        "equipment": (advert.get("equipment") or [])[:2],
        "priceDrop": advert.get("priceDrop"),
    }
    return {"props": {"pageProps": {"advert": advert}}}


def main() -> int:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    settings = Settings(rps=1.0)
    with Client(settings) as client:
        search_html = client.get(settings.search_url(1)).text
        search = trim_search(extract_next_data(search_html))
        (FIXTURES / "search_next_data.json").write_text(
            json.dumps(search, ensure_ascii=False), encoding="utf-8"
        )

        first = json.loads(next(iter(search["props"]["pageProps"]["urqlState"].values()))["data"])
        url = first["advertSearch"]["edges"][0]["node"]["url"]
        offer_html = client.get(url).text
        offer = trim_offer(extract_next_data(offer_html))
        (FIXTURES / "offer_next_data.json").write_text(
            json.dumps(offer, ensure_ascii=False), encoding="utf-8"
        )

    for path in sorted(FIXTURES.glob("*.json")):
        print(f"{path.name}: {path.stat().st_size / 1024:.0f} КБ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
