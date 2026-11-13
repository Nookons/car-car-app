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

# Не снимаем объявление, если его видели меньше суток до старта прохода:
# выдача otomoto двигается, и часть активных объявлений может «перескочить»
# страницу во время многочасового обхода. Суточный запас отсекает такие
# ложные снятия, не мешая убирать реально старые записи.
REMOVAL_GRACE_DAYS = 1

# Допустимая доля ошибок страниц в полном обходе. Если ошибок больше, проход
# не подтверждает снятия: иначе объявления с упавшей страницы «исчезнут».
MAX_SWEEP_ERROR_RATIO = 0.01

# Классификация снятия. Площадка не отдаёт «продано», поэтому это эвристика:
#   * expired — ровно тот же срок, что и обычное размещение (30 дней), без
#     изменения цены; так уходит основная масса старых объявлений;
#   * sold_candidate — цена падала перед снятием: продавец торговался;
#   * unknown — сигнала не хватило.
OUTCOME_SOLD = "sold_candidate"
OUTCOME_EXPIRED = "expired"
OUTCOME_UNKNOWN = "unknown"

EXPIRY_WINDOW_DAYS = 28.0
PRICE_DROP_THRESHOLD_PCT = -3.0


def classify_outcome(
    dom_days: float,
    price_change_pct: float | None,
    price_changes: int = 0,
) -> tuple[str, str]:
    """Пытается отличить продажу от истечения срока размещения.

    Возвращает `(outcome, reason)`. Это не истина, а кандидат для индекса:
    цена вниз перед снятием — сильный сигнал торга; ровные 30 дней без
    изменения цены — почти наверняка истечение. Всё остальное — `unknown`,
    чтобы не выдумывать продажу.
    """
    change = 0.0 if price_change_pct is None else price_change_pct
    if price_change_pct is not None and price_change_pct <= PRICE_DROP_THRESHOLD_PCT:
        return OUTCOME_SOLD, "price_drop_before_removal"
    if dom_days >= EXPIRY_WINDOW_DAYS and abs(change) < 1.0:
        return OUTCOME_EXPIRED, "expiry_window_no_price_change"
    if price_changes > 0:
        return OUTCOME_UNKNOWN, "price_changed_but_no_drop"
    return OUTCOME_UNKNOWN, "insufficient_signal"



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
    errors: int,
    stopped_early: bool,
    max_error_ratio: float = MAX_SWEEP_ERROR_RATIO,
) -> bool:
    """Можно ли считать, что полный обход действительно дошёл до конца.

    Условия: известен `total_pages`, пройдены все страницы, обход не прерван
    лимитом/дедлайном, а ошибок не больше допустимой доли. При сомнении
    лучше не подтверждать снятия — следующий проход всё исправит.

    `page` — следующая страница после последней обработанной. Если проход
    был разбит на несколько запусков (resume), счётчик страниц текущего
    процесса меньше `total_pages`; это нормально, главное — дошли до конца.
    """
    if stopped_early or total_pages is None or total_pages <= 0:
        return False
    if page <= total_pages:
        return False
    allowed = max(1, int(total_pages * max(0.0, max_error_ratio)))
    return errors <= allowed
