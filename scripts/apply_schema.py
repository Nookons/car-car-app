#!/usr/bin/env python3
"""Применение канонической схемы CarCar к базе Supabase.

    DATABASE_URL='postgresql://...' .venv/bin/python scripts/apply_schema.py

Скрипт идемпотентный: таблицы создаются через IF NOT EXISTS, индексы тоже.
Схема — carcar/schema.sql.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "carcar" / "schema.sql"
ENV_FILE = ROOT / ".env.supabase"


def load_url() -> str:
    url = os.environ.get("CARCAR_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    if not url and ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip("'\"")
                break
    if not url:
        raise SystemExit("нужен DATABASE_URL или CARCAR_DATABASE_URL")
    if "ljkugtpeboomboobodom" in url.lower():
        raise SystemExit("СТОП: это складская эко-система, сюда нельзя")
    return url


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, default=SCHEMA)
    args = parser.parse_args()

    import psycopg

    url = load_url()
    sql = args.schema.read_text(encoding="utf-8")

    with psycopg.connect(url, connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                """
                select tablename from pg_tables
                where schemaname = 'public' and tablename <> 'spatial_ref_sys'
                order by 1
                """
            )
            tables = [row[0] for row in cur.fetchall()]
        conn.commit()

    print(f"схема применена, таблиц: {len(tables)}")
    for name in tables:
        print(f"  - {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
