#!/usr/bin/env python3
"""Сброс схемы public в проекте CarCar на Supabase.

Использование:

    export DATABASE_URL='postgresql://postgres.<ref>:<пароль>@aws-0-<region>.pooler.supabase.com:6543/postgres'
    .venv/bin/python scripts/db_reset.py --dry-run   # показать, что удалится
    .venv/bin/python scripts/db_reset.py --yes       # удалить

Защита: скрипт отказывается работать с проектом складской эко-системы
(ljkugtpeboomboobodom) и с любым хостом, где нет слова supabase.

Пароль в командной строке не передаём — только через переменную окружения
или файл .env.supabase (он в .gitignore).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

SQL_FILE = Path(__file__).with_name("reset_supabase.sql")
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.supabase"

# Проект складской эко-системы: удалять оттуда таблицы нельзя ни при каких условиях.
FORBIDDEN_HOSTS = ("ljkugtpeboomboobodom",)


def load_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url and ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip("'\"")
                break
    if not url:
        raise SystemExit(
            "нужен DATABASE_URL: строка подключения Supabase "
            "(Project Settings → Database → Connection string → URI)"
        )
    return url


def guard(url: str) -> None:
    lowered = url.lower()
    for host in FORBIDDEN_HOSTS:
        if host in lowered:
            raise SystemExit(
                f"СТОП: это проект складской эко-системы ({host}). "
                "Удаление запрещено — проверьте, что взяли строку проекта CarCar."
            )
    if "supabase" not in lowered:
        raise SystemExit("СТОП: строка не похожа на Supabase — проверьте, что это нужный проект.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="только показать таблицы")
    parser.add_argument("--yes", action="store_true", help="подтвердить удаление")
    args = parser.parse_args()

    if not args.dry_run and not args.yes:
        raise SystemExit("нужен --yes (или --dry-run, чтобы посмотреть список)")

    import psycopg

    url = load_url()
    guard(url)

    with psycopg.connect(url, connect_timeout=20) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select tablename from pg_tables where schemaname='public' order by 1"
            )
            tables = [row[0] for row in cur.fetchall()]

        print(f"проект: {url.split('@')[-1].split('/')[0]}")
        print(f"таблиц в public: {len(tables)}")
        for name in tables:
            print(f"  - {name}")

        if args.dry_run:
            print("\n--dry-run: ничего не удалено")
            return 0

        with conn.cursor() as cur:
            cur.execute(SQL_FILE.read_text(encoding="utf-8"))
            cur.execute(
                """
                select count(*) from pg_tables t
                where t.schemaname = 'public'
                  and not exists (
                      select 1 from pg_class c
                      join pg_namespace n on n.oid = c.relnamespace
                      join pg_depend d on d.objid = c.oid and d.deptype = 'e'
                      where n.nspname = 'public' and c.relname = t.tablename
                  )
                """
            )
            left = cur.fetchone()[0]
        conn.commit()

    print(f"\nготово: таблиц в public осталось {left}")
    return 0 if left == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
