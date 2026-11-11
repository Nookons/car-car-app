"""Один «котёл» интереса: схема и миграция должны считаться одинаково.

Формула score живёт в двух местах — канонической схеме (`carcar/schema.sql`,
по ней поднимают новую базу) и миграции (её применяют к живой базе). Если
править только одну, новая база начнёт ранжировать иначе, чем прод, и это
никто не заметит: ошибок нет, просто выдача другая. Тест сверяет тело функции
и набор счётчиков.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "carcar" / "schema.sql").read_text(encoding="utf-8")
MIGRATION = (ROOT / "db" / "migrations" / "20261113_engagement_pool.sql").read_text(
    encoding="utf-8"
)


def _normalize(sql: str) -> str:
    """Убирает комментарии и лишние пробелы: смысл, а не форматирование."""
    without_comments = re.sub(r"--[^\n]*", "", sql)
    # Квалификатор схемы не важен: schema.sql пишет listing_stat, миграция —
    # public.listing_stat, это одно и то же.
    without_comments = without_comments.replace("public.", "")
    return re.sub(r"\s+", " ", without_comments).strip()


def _function_body(sql: str, name: str) -> str:
    match = re.search(
        rf"function\s+(?:public\.)?{name}\s*\(.*?\).*?\$\$(.*?)\$\$",
        sql,
        re.S,
    )
    assert match, f"функция {name} не найдена"
    return _normalize(match.group(1))


def test_score_function_is_identical_in_schema_and_migration():
    assert _function_body(SCHEMA, "listing_engagement_score") == _function_body(
        MIGRATION, "listing_engagement_score"
    ), "формула в schema.sql разошлась с миграцией"


def test_trigger_recomputes_score_in_both_files():
    trigger = _normalize(
        "create trigger listing_stat_score before insert or update of "
        "views, impressions, favorites, likes, comments, reposts "
        "on listing_stat for each row execute function listing_stat_recalc_score()"
    )
    for name, sql in (("schema.sql", SCHEMA), ("migration", MIGRATION)):
        assert "listing_stat_score" in sql, f"{name}: нет триггера пересчёта"
        assert trigger in _normalize(sql), f"{name}: триггер отличается от эталона"


def test_counters_exist_in_both_files():
    for name, sql in (("schema.sql", SCHEMA), ("migration", MIGRATION)):
        for column in ("impressions", "favorites"):
            assert re.search(rf"\b{column}\b", sql), f"{name}: нет колонки {column}"


def test_runtime_role_can_execute_score_function():
    assert "grant execute on function listing_engagement_score" in _normalize(MIGRATION), (
        "carcar_runtime не сможет пересчитать score"
    )
