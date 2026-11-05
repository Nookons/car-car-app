#!/usr/bin/env python3
"""
Замер задержки публикации, версия 2.

Отличие от v1: для каждого впервые увиденного объявления запоминаем его
createdAt и время, когда мы его впервые увидели. Итог — распределение
«сколько объявление прожило до того, как попало в выдачу».

    python3 scripts/latency_probe.py --minutes 10 --interval 10

Пишет data/latency2-<timestamp>.json и печатает процентили.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import probe_otomoto as p  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "data"
WARMUP_SECONDS = 30  # первые поллинги — прогрев, в статистику не идут


def parse_ts(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def pct(values: list[float], q: float) -> float:
    if not values:
        return float("nan")
    values = sorted(values)
    k = (len(values) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (k - lo)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=10)
    ap.add_argument("--interval", type=float, default=10)
    ap.add_argument("--pages", type=int, default=2)
    args = ap.parse_args()

    DATA.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = DATA / f"latency2-{stamp}.json"

    started = time.time()
    first_seen: dict[str, dict] = {}
    polls: list[dict] = []
    deadline = started + args.minutes * 60

    while time.time() < deadline:
        t0 = time.time()
        found = []
        for page in range(1, args.pages + 1):
            url = p.SEARCH_URL + (f"&page={page}" if page > 1 else "")
            text = p.fetch(url)
            search = p.advert_search(p.next_data(text))
            for e in search["edges"]:
                n = e["node"]
                found.append((n["id"], n["createdAt"], page))
        seen_at = datetime.now(timezone.utc)

        batch = []
        for ext_id, created, page in found:
            if ext_id in first_seen:
                continue
            lag = (seen_at - parse_ts(created)).total_seconds()
            rec = {
                "id": ext_id,
                "created": created,
                "page": page,
                "lag": round(lag, 1),
                "warmup": (t0 - started) < WARMUP_SECONDS,
            }
            first_seen[ext_id] = rec
            if not rec["warmup"]:
                batch.append(rec)

        row = {
            "at": seen_at.isoformat(),
            "items": len(found),
            "new": len(batch),
            "max_created": max((c for _, c, _ in found), default=None),
            "lags": [x["lag"] for x in batch],
        }
        polls.append(row)
        if batch:
            print(f"{seen_at.strftime('%H:%M:%S')}  новых {len(batch):2} | "
                  f"лаг " + ", ".join(f"{x['lag']:.0f}" for x in batch) + " с", flush=True)
        else:
            print(f"{seen_at.strftime('%H:%M:%S')}  новых  0", flush=True)

        time.sleep(max(1.0, args.interval - (time.time() - t0)))

    all_lags = [x["lag"] for x in first_seen.values() if not x["warmup"]]
    # Свежие отдельно от «поднятых»: у поднятых createdAt может быть месячной
    # давности, и общая медиана по ним ничего не говорит о скорости публикации.
    lags = [x for x in all_lags if x <= 6 * 3600]
    summary = {
        "interval": args.interval,
        "duration_min": round((time.time() - started) / 60, 1),
        "new_total": len(all_lags),
        "fresh_total": len(lags),
        "lag_p50": round(pct(lags, 0.5), 1),
        "lag_p90": round(pct(lags, 0.9), 1),
        "lag_p95": round(pct(lags, 0.95), 1),
        "lag_max": round(max(lags), 1) if lags else None,
        "lag_min": round(min(lags), 1) if lags else None,
        "items": sorted(first_seen.values(), key=lambda r: r["created"]),
        "polls": polls,
    }
    out_path.write_text(json.dumps(summary, ensure_ascii=False, indent=1))

    print(f"\nвсего новых после прогрева: {summary['new_total']} "
          f"(свежих ≤6 ч: {summary['fresh_total']})")
    if lags:
        print(f"лаг публикации: p50 {summary['lag_p50']} с | p90 {summary['lag_p90']} с | "
              f"p95 {summary['lag_p95']} с | max {summary['lag_max']} с")
        print(f"медиана по интервалам между новыми: "
              f"{60 / max(0.1, summary['new_total'] / summary['duration_min']):.1f} с "
              f"({summary['new_total'] / summary['duration_min']:.1f} новых в минуту)")
    print(f"лог: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
