#!/usr/bin/env python3
"""Замер «до/после» для сборщика: наивный urllib против httpx + brotli.

Смысл — не «доказать, что httpx лучше», а увидеть цену решения в цифрах:
сколько секунд и килобайт стоит одна страница выдачи в каждом варианте.

    .venv/bin/python scripts/bench_fetch.py --pages 3
"""

from __future__ import annotations

import argparse
import gzip
import statistics
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from carcar.client import Client  # noqa: E402
from carcar.config import Settings  # noqa: E402
from carcar.parse import extract_next_data, parse_search  # noqa: E402

UA = Settings().user_agent


def bench_urllib(urls: list[str]) -> dict:
    times, sizes = [], []
    for url in urls:
        request = urllib.request.Request(url, headers={"User-Agent": UA})
        started = time.monotonic()
        with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310
            body = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
        times.append(time.monotonic() - started)
        sizes.append(len(body))
    return {"times": times, "bytes": sizes}


def bench_httpx(urls: list[str]) -> dict:
    settings = Settings(rps=1000)  # для замера темпа не ограничиваем
    times, wire = [], []
    with Client(settings) as client:
        for url in urls:
            result = client.get(url)
            times.append(result.elapsed)
            wire.append(result.wire_bytes)
    return {"times": times, "bytes": wire}


def bench_parse(html: str, repeats: int = 3) -> float:
    started = time.monotonic()
    for _ in range(repeats):
        parse_search(html)
    return (time.monotonic() - started) / repeats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=3)
    args = parser.parse_args()

    settings = Settings()
    urls = [settings.search_url(page) for page in range(1, args.pages + 1)]

    print(f"URL: {args.pages} страниц выдачи\n")

    naive = bench_urllib(urls)
    fast = bench_httpx(urls)

    with Client(Settings(rps=1000)) as client:
        sample = client.get(urls[0]).text
    parse_seconds = bench_parse(sample)

    print(f"{'вариант':28} {'медиана, с':>11} {'всего, МБ':>10} {'на стр., КБ':>12}")
    print("-" * 66)
    for name, data in (
        ("urllib, без сжатия", naive),
        ("httpx + brotli + keep-alive", fast),
    ):
        total_mb = sum(data["bytes"]) / 1e6
        per_page = sum(data["bytes"]) / len(urls) / 1024
        print(
            f"{name:28} {statistics.median(data['times']):>11.2f} "
            f"{total_mb:>10.2f} {per_page:>12.0f}"
        )

    speed = statistics.median(naive["times"]) / max(statistics.median(fast["times"]), 1e-9)
    traffic = sum(naive["bytes"]) / max(sum(fast["bytes"]), 1)
    print("-" * 66)
    print(f"быстрее в {speed:.1f}×, трафика меньше в {traffic:.1f}×")
    print(f"разбор страницы (JSON): {parse_seconds * 1000:.0f} мс — не узкое место")

    # за 24 часа поллинга раз в 15 секунд
    polls_per_day = 24 * 3600 / 15
    saved_gb = (sum(naive["bytes"]) - sum(fast["bytes"])) / len(urls) * polls_per_day / 1e9
    print(f"экономия за сутки поллинга раз в 15 с: ~{saved_gb:.1f} ГБ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
