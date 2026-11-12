"""Правила жизненного цикла объявления: срок на рынке и подтверждение снятия.

Модуль намеренно без БД: формулы можно проверить тестами и переиспользовать
в скриптах. Запись в `listing_lifecycle` и обновление `listing` — в `db.py`.

Термины:
  * «снято» (off_market) — объявление исчезло из выдачи площадки. Это не
    обязательно продажа: причина может быть в истечении срока или снятии
    продавцом. Поэтому в коде и в отчётах пишем `removed`, а не `sold`.
  * `dom_days` (days on market) — сколько объявление было активно. Нижняя
    оценка: от `published_at`/`first_seen_at` до последнего наблюдения.
    Верхняя граница — `removed_at`, но она зависит от расписания sweep.
"""

from __future__ import annotations

from datetime import datetime

# Сколько полных обходов подряд объявление должно отсутствовать, прежде чем
# считать его снятым. Два прохода защищают от ложного снятия, если страница
# выдачи один раз не открылась.
MISSES_TO_REMOVE = 2

# Допустимая доля ошибок страниц в полном обходе. Если ошибок больше, проход
# не подтверждает снятия: иначе объявления с упавшей страницы «исчезнут».
MAX_SWEEP_ERROR_RATIO = 0.01


def effective_start(
    published_at: datetime | None, first_seen_at: datetime
) -> tuple[datetime, str]:
    """Когда объявление реально появилось на рынке.

    `published_at` — дата площадки, она точнее. Если её нет или она позже
    первого наблюдения (битые данные), берём `first_seen_at`.
    """
    if published_at is not None and published_at <= first_seen_at:
        return published_at, "published_at"
    return first_seen_at, "first_seen_at"


def dom_days(
    published_at: datetime | None,
    first_seen_at: datetime,
    last_seen_at: datetime,
) -> tuple[float, str]:
    """Срок на рынке в днях и база расчёта.

    Используем `last_seen_at`, а не `removed_at`: последнее наблюдение —
    консервативная нижняя граница, не зависящая от длительности sweep.
    """
    start, basis = effective_start(published_at, first_seen_at)
    seconds = (last_seen_at - start).total_seconds()
    return max(0.0, round(seconds / 86_400, 2)), basis


def price_change_pct(first_price: object, last_price: object) -> float | None:
    """Изменение последней цены к первой, в процентах. Минус — подешевело."""
    try:
        first = float(first_price)  # type: ignore[arg-type]
        last = float(last_price)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if first <= 0:
        return None
    return round((last - first) / first * 100, 2)


def next_missed(seen: bool, current: int) -> int:
    """Счётчик пропусков: видели — сбрасываем, не видели — увеличиваем."""
    return 0 if seen else max(0, current) + 1


def is_confirmed(missed: int, min_misses: int = MISSES_TO_REMOVE) -> bool:
    return missed >= max(1, min_misses)


def pass_completed(
    *,
    page: int,
    total_pages: int | None,
    pages: int,
    errors: int,
    stopped_early: bool,
    max_error_ratio: float = MAX_SWEEP_ERROR_RATIO,
) -> bool:
    """Можно ли считать, что полный обход действительно дошёл до конца.

    Условия: известен `total_pages`, пройдены все страницы, обход не прерван
    лимитом/дедлайном, а ошибок не больше допустимой доли. При сомнении
    лучше не подтверждать снятия — следующий проход всё исправит.
    """
    if stopped_early or total_pages is None or total_pages <= 0:
        return False
    if page <= total_pages or pages < total_pages:
        return False
    allowed = max(1, int(pages * max(0.0, max_error_ratio)))
    return errors <= allowed
