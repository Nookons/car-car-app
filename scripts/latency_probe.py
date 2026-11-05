#!/usr/bin/env python3
"""
Замер задержки публикации: как быстро новое объявление появляется в выдаче.

Поллим первые страницы «свежих» с заданным интервалом и на каждом шаге
смотрим максимальный createdAt. Разница «сейчас − createdAt» — это задержка
площадки (сколько живёт объявление до того, как его видно), она же — нижняя
граница нашей задержки уведомления.

    python3 scripts/latency_probe.py --minutes 8 --interval 20

Пишет JSON-лог в data/latency-<timestamp>.json и печатает сводку.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import probe_otomoto as p  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "data"


def now_utc() -> datetime:
    return datetime.now(UTC)


def parse_ts(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=8)
    ap.add_argument("--interval", type=float, default=20)
    ap.add_argument("--pages", type=int, default=2)
    args = ap.parse_args()

    DATA.mkdir(exist_ok=True)
    stamp = now_utc().strftime("%Y%m%dT%H%M%SZ")
    out_path = DATA / f"latency-{stamp}.json"

    seen: set[str] = set()
    polls: list[dict] = []
    deadline = time.time() + args.minutes * 60

    while time.time() < deadline:
        t0 = time.time()
        pages_data = []
        for page in range(1, args.pages + 1):
            url = p.SEARCH_URL + (f"&page={page}" if page > 1 else "")
            t_fetch = now_utc()
            raw = p.fetch(url)                     # уже распакованный текст страницы
            search = p.advert_search(p.next_data(raw))
            pages_data.append({
                "page": page,
                "fetch_started": t_fetch.isoformat(),
                "bytes": len(raw.encode("utf-8")),
                "edges": search["edges"],
            })

        newest = None
        new_ids: list[str] = []
        for pd in pages_data:
            for e in pd["edges"]:
                n = e["node"]
                c = parse_ts(n["createdAt"])
                if newest is None or c > newest[0]:
                    newest = (c, n["id"], pd["page"])
                if n["id"] not in seen:
                    seen.add(n["id"])
                    new_ids.append(n["id"])

        t1 = now_utc()
        lag = (t1 - newest[0]).total_seconds() if newest else None
        row = {
            "at": t1.isoformat(),
            "newest_created": newest[0].isoformat() if newest else None,
            "newest_id": newest[1] if newest else None,
            "newest_page": newest[2] if newest else None,
            "lag_seconds": round(lag, 1) if lag is not None else None,
            "new_ids": new_ids,
            "fetch_ms": round((time.time() - t0) * 1000),
            "bytes": sum(pd["bytes"] for pd in pages_data),
        }
        polls.append(row)
        print(f"{row['at'][11:19]}  лаг {row['lag_seconds']:>6} с | "
              f"новых id: {len(new_ids):2} | {row['bytes']/1024:6.0f} КБ | "
              f"{row['fetch_ms']:4} мс", flush=True)

        time.sleep(max(1.0, args.interval - (time.time() - t0)))

    lags = [x["lag_seconds"] for x in polls if x["lag_seconds"] is not None]
    summary = {
        "polls": polls,
        "lag_median": round(statistics.median(lags), 1),
        "lag_min": min(lags),
        "lag_max": max(lags),
        "new_ids_total": sum(len(x["new_ids"]) for x in polls),
        "interval": args.interval,
    }
    out_path.write_text(json.dumps(summary, ensure_ascii=False, indent=1))
    print(f"\nлаг публикации: медиана {summary['lag_median']} с, "
          f"min {summary['lag_min']} с, max {summary['lag_max']} с")
    print(f"новых id за прогон: {summary['new_ids_total']}")
    print(f"лог: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
