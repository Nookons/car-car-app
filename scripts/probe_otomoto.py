#!/usr/bin/env python3
"""
Разведка otomoto.pl: забираем страницу поиска и достаём объявления.

Зачем: проверить, что данные отдаются обычным HTTP-запросом (без браузера и
без обхода защиты), и что структура пригодна для нормализации.

Как работает: страница otomoto — Next.js. Вся выдача поиска уже лежит в HTML
внутри <script id="__NEXT_DATA__">, в urqlState (это состояние GraphQL-клиента,
отрендеренное на сервере). Достаточно распарсить JSON — никакого выполнения JS.

Запуск (только стандартная библиотека, python 3.9+):

    python3 scripts/probe_otomoto.py                  # 1 страница выдачи
    python3 scripts/probe_otomoto.py --pages 3        # 3 страницы по 32
    python3 scripts/probe_otomoto.py --detail <url>   # карточка объявления

Требование к этике: 1 запрос в секунду, не больше. Скрипт сам себя тормозит.
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import time
import urllib.request
from dataclasses import dataclass
from typing import Any

BASE = "https://www.otomoto.pl"
# Сортировка по дате добавления: так инкрементальный сбор видит новинки первыми
# и может остановиться, дойдя до уже известных объявлений.
SEARCH_URL = BASE + "/osobowe?search%5Border%5D=created_at%3Adesc"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S
)


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------
def fetch(url: str, timeout: int = 30) -> str:
    """Один GET с нормальными заголовками. Без куков, без прокси, без JS."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
        return raw.decode("utf-8", errors="replace")


def next_data(html: str) -> dict[str, Any]:
    m = NEXT_DATA_RE.search(html)
    if not m:
        raise RuntimeError("__NEXT_DATA__ не найден — страница изменилась или нас заблокировали")
    return json.loads(m.group(1))


def advert_search(data: dict[str, Any]) -> dict[str, Any]:
    """Находит в urqlState результат запроса advertSearch (выдача поиска)."""
    state = data["props"]["pageProps"].get("urqlState") or {}
    for entry in state.values():
        payload = entry.get("data")
        if not isinstance(payload, str):
            continue
        try:
            obj = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if "advertSearch" in obj:
            return obj["advertSearch"]
    raise RuntimeError("advertSearch не найден в urqlState")


# --------------------------------------------------------------------------
# Разбор
# --------------------------------------------------------------------------
@dataclass
class Row:
    external_id: str
    created: str
    title: str
    make: str
    model: str
    year: str
    mileage: str
    price: str
    currency: str
    city: str
    region: str
    seller_type: str
    url: str


def params_to_dict(node: dict[str, Any]) -> dict[str, str]:
    """parameters — плоский список {key, value, displayValue}."""
    return {
        p["key"]: p.get("displayValue") or p.get("value") or ""
        for p in node.get("parameters") or []
    }


def to_row(node: dict[str, Any]) -> Row:
    p = params_to_dict(node)
    price = node.get("price") or {}
    amount = price.get("amount") or {}
    return Row(
        external_id=str(node.get("id")),
        created=(node.get("createdAt") or "")[:16].replace("T", " "),
        title=(node.get("title") or "")[:60],
        make=p.get("make", ""),
        model=p.get("model", ""),
        year=p.get("year", ""),
        mileage=p.get("mileage", ""),
        price=amount.get("value", ""),
        currency=amount.get("currencyCode", ""),
        city=((node.get("location") or {}).get("city") or {}).get("name", ""),
        region=((node.get("location") or {}).get("region") or {}).get("name", ""),
        seller_type=(node.get("seller") or {}).get("__typename", ""),
        url=node.get("url", ""),
    )


def short(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def cmd_search(pages: int) -> None:
    total_seen = 0
    grand_total: int | None = None
    t_all = time.time()

    for page in range(1, pages + 1):
        url = SEARCH_URL if page == 1 else f"{SEARCH_URL}&page={page}"
        t0 = time.time()
        html = fetch(url)
        data = next_data(html)
        search = advert_search(data)
        t1 = time.time()

        if grand_total is None:
            grand_total = search.get("totalCount")
            page_info = search.get("pageInfo") or {}
            print(f"Всего объявлений в категории «osobowe»: {grand_total:,}".replace(",", " "))
            print(f"Размер страницы (pageSize): {page_info.get('pageSize')}")
            print()

        rows = [to_row(e["node"]) for e in search["edges"]]
        total_seen += len(rows)

        print(f"--- страница {page}: {len(rows)} объявлений, "
              f"HTML {len(html) / 1e6:.2f} МБ, {t1 - t0:.2f} с")
        for r in rows[:8]:
            print(f"  {r.external_id} {r.created} | {short(r.make + ' ' + r.model, 22):22} "
                  f"{r.year} {short(r.mileage, 12):12} | {r.price:>9} {r.currency} | "
                  f"{short(r.city, 14):14} {r.seller_type}")
        if len(rows) > 8:
            print(f"  … ещё {len(rows) - 8}")

        time.sleep(1.0)  # вежливость: не чаще 1 запроса в секунду

    dt = time.time() - t_all
    print()
    print(f"Итого: {total_seen} объявлений за {dt:.1f} с "
          f"({total_seen / dt:.1f} объявл./с)")
    if grand_total:
        pages_needed = -(-grand_total // 32)
        print(f"Полный обход рынка: ~{pages_needed} страниц "
              f"(≈ {pages_needed * 1.6 / 1024:.1f} ГБ HTML, "
              f"≈ {pages_needed / 3600:.1f} ч при 1 запросе/с)")


def cmd_detail(url: str) -> None:
    html = fetch(url)
    page = next_data(html)["props"]["pageProps"]
    a = page["advert"]
    details = {d["key"]: d.get("value") for d in a.get("details") or []}
    photos = ((a.get("images") or {}).get("photos")) or []
    desc = re.sub(r"<[^>]+>", " ", a.get("description") or "")
    desc = re.sub(r"\s+", " ", desc).strip()

    print(
        f"ID:           {a.get('id')}  "
        f"(originAdId={a.get('originAdId')}, site={a.get('originSiteCode')})"
    )
    print(f"Заголовок:    {a.get('title')}")
    print(f"Цена:         {a.get('price')}")
    print(f"Создано:      {a.get('createdAt')}   обновлено: {a.get('updatedAt')}")
    print(f"Продавец:     {a.get('seller', {}).get('type')} — {a.get('seller', {}).get('name')}")
    print(f"Фото:         {len(photos)} шт.")
    print(f"Описание:     {len(desc)} символов: {short(desc, 160)}")
    print(f"VIN:          {details.get('vin') or '—'}")
    print(f"Поля:         make={details.get('make')} model={details.get('model')} "
          f"year={details.get('year')} mileage={details.get('mileage')} "
          f"fuel={details.get('fuel_type')} gearbox={details.get('gearbox')} "
          f"power={details.get('engine_power')} cm3={details.get('engine_capacity')}")
    print(f"Группы полей: {[g.get('key') for g in a.get('detailsGroups') or []]}")
    equipment = sum(len(g.get("values") or []) for g in a.get("equipment") or [])
    print(f"Оснащение:    {equipment} пунктов")


def main() -> int:
    ap = argparse.ArgumentParser(description="Разведка выдачи otomoto.pl")
    ap.add_argument("--pages", type=int, default=1, help="сколько страниц выдачи забрать")
    ap.add_argument("--detail", metavar="URL", help="разобрать карточку объявления")
    args = ap.parse_args()

    if args.detail:
        cmd_detail(args.detail)
    else:
        cmd_search(max(1, args.pages))
    return 0


if __name__ == "__main__":
    sys.exit(main())
