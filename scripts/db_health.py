#!/usr/bin/env python3
"""Read-only health-check Supabase/Postgres для CarCar.

Использование:
    set -a; . ./.env.supabase; set +a
    .venv/bin/python scripts/db_health.py
    .venv/bin/python scripts/db_health.py --json

Ничего не пишет в БД: транзакция READ ONLY + statement_timeout.
Код возврата: 0 — всё в норме, 1 — есть предупреждения, 2 — нет соединения.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import UTC, datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row


ALERTS = {
    "active_queries_over_5s": 1,
    "collector_lag_min": 10,
    "market_metric_rows": 1_000,
}


def check() -> dict[str, Any]:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL не задан (см. .env.supabase)")

    conn = psycopg.connect(
        dsn,
        connect_timeout=15,
        prepare_threshold=None,
        autocommit=False,
        row_factory=dict_row,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("set transaction read only")
            cur.execute("set local statement_timeout = '10000ms'")
            cur.execute(
                """
                select current_setting('max_connections') as max_connections,
                       current_setting('shared_buffers') as shared_buffers,
                       current_setting('effective_cache_size') as effective_cache_size,
                       pg_size_pretty(pg_database_size(current_database())) as db_size,
                       (select temp_bytes from pg_stat_database
                         where datname = current_database()) as temp_bytes,
                       (select count(*) from pg_stat_activity
                         where datname = current_database() and state = 'active') as active_queries,
                       (select count(*) from pg_stat_activity
                         where datname = current_database()
                           and state = 'active'
                           and query_start < now() - interval '5 seconds') as active_queries_over_5s,
                       (select count(*) from listing where status = 'active') as active_listings,
                       (select count(*) from listing
                         where status = 'active' and details_fetched_at is null) as needs_details,
                       (select count(*) from listing_market_metric) as market_metric_rows,
                       (select max(heartbeat_at) from collector) as collector_heartbeat
                """
            )
            row = dict(cur.fetchone() or {})
    finally:
        conn.rollback()
        conn.close()

    heartbeat = row.get("collector_heartbeat")
    lag = None
    if isinstance(heartbeat, datetime):
        lag = max(0.0, (datetime.now(UTC) - heartbeat).total_seconds() / 60)

    row["collector_lag_min"] = round(lag, 1) if lag is not None else None
    warnings: list[str] = []
    if row.get("active_queries_over_5s", 0) > ALERTS["active_queries_over_5s"]:
        warnings.append(f"долгих активных запросов: {row['active_queries_over_5s']}")
    if lag is not None and lag > ALERTS["collector_lag_min"]:
        warnings.append(f"collector молчит {lag:.0f} мин")
    if row.get("market_metric_rows", 0) > ALERTS["market_metric_rows"]:
        warnings.append(f"listing_market_metric разрослась: {row['market_metric_rows']}")
    row["warnings"] = warnings
    return row


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--alert", action="store_true", help="отправить warnings в Telegram")
    args = parser.parse_args()
    try:
        data = check()
    except Exception as exc:  # noqa: BLE001
        print(f"DB health: ERROR {type(exc).__name__}: {str(exc)[:300]}")
        return 2
    if args.json:
        print(json.dumps(data, default=str, ensure_ascii=False, indent=2))
    else:
        print(
            "DB: {db_size}, active listings: {active_listings}, "
            "без карточки: {needs_details}, market_metric: {market_metric_rows}".format(**data)
        )
        print(
            "connections: active={active_queries}, >5s={active_queries_over_5s}, "
            "max={max_connections}; shared_buffers={shared_buffers}; "
            "effective_cache={effective_cache_size}; temp_bytes={temp_bytes}".format(**data)
        )
        if data["collector_lag_min"] is not None:
            print(f"collector heartbeat: {data['collector_lag_min']} мин назад")
        for warning in data["warnings"]:
            print(f"WARN: {warning}")
        if not data["warnings"]:
            print("OK")
    if args.alert and data["warnings"]:
        token = os.environ.get("CARCAR_BOT_TOKEN")
        chat = os.environ.get("CARCAR_ADMIN_CHAT_ID")
        if token and chat:
            text = "⚠️ CarCar DB health\n" + "\n".join(data["warnings"])
            payload = json.dumps({"chat_id": chat, "text": text}).encode()
            request = urllib.request.Request(
                f"https://api.telegram.org/bot{token}/sendMessage",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=10):
                    pass
            except Exception as exc:  # noqa: BLE001
                print(f"ALERT: не отправлен: {type(exc).__name__}")
        else:
            print("ALERT: CARCAR_BOT_TOKEN/CARCAR_ADMIN_CHAT_ID не заданы")
    return 1 if data["warnings"] else 0


if __name__ == "__main__":
    sys.exit(main())
