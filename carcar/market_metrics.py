"""Рыночные метрики объявления: цена, позиция и срок у похожих.

Считает то же, что показывает карточка (`analyse_price`), и добавляет
жизненный цикл: сколько похожих снято, сколько из них похоже на продажу и
какая медиана `dom_days`. Результат — одна текущая строка в
`listing_market_metric`.

Модуль можно вызывать после вставки нового объявления (watch), из CLI для
бэкфилла и из тестов на чистых данных.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from .miniapp.price_model import MODEL_VERSION, analyse_price

ACTIVE_COMPS_SQL = """
with page as (
    select id, make, model, price, year, mileage_km
    from listing
    where id = any(%(ids)s::bigint[])
),
comps as (
    select p.id as subject_id,
           c.id, c.title, c.price, c.year, c.mileage_km, c.engine_cm3,
           c.power_hp, c.body, c.gearbox, c.drive, c.fuel, c.color,
           c.generation, c.equipment[1:8] as equipment,
           row_number() over (
               partition by p.id
               order by abs(c.year - p.year) nulls last,
                        abs(c.mileage_km - p.mileage_km) nulls last
           ) as rn
    from page p
    join listing c
      on c.make = p.make and c.model = p.model
     and c.status = 'active' and c.price is not null
     and c.id <> p.id
     and (p.year is null or c.year between p.year - 6 and p.year + 6)
     and (
         p.mileage_km is null
         or c.mileage_km between p.mileage_km * 0.4 and p.mileage_km * 1.8
     )
)
select * from comps where rn <= 60
"""

LIFECYCLE_COMPS_SQL = """
with page as (
    select id, make, model, year, mileage_km
    from listing
    where id = any(%(ids)s::bigint[])
),
comps as (
    select p.id as subject_id,
           lc.listing_id, lc.dom_days, lc.outcome, lc.price_change_pct,
           lc.detection_lag_days, lc.removed_at,
           row_number() over (
               partition by p.id order by lc.removed_at desc
           ) as rn
    from page p
    join listing_lifecycle lc
      on lc.make = p.make and lc.model = p.model
     and lc.removal_kind <> 'legacy'
     and lc.detection_lag_days <= 1
     and lc.removed_at > now() - interval '365 days'
     and (p.year is null or lc.year between p.year - 6 and p.year + 6)
     and (
         p.mileage_km is null
         or lc.mileage_km between p.mileage_km * 0.4 and p.mileage_km * 1.8
     )
)
select * from comps where rn <= 60
"""


def _quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = max(0.0, min(1.0, q)) * (len(ordered) - 1)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def segment_key(subject: dict[str, Any]) -> str:
    """Стабильный ключ когорты для группировки и кэша."""
    make = str(subject.get("make") or "").strip().lower()
    model = str(subject.get("model") or "").strip().lower()
    year = subject.get("year")
    band = f"{int(year) // 5 * 5}" if year else ""
    parts = [
        make,
        model,
        band,
        str(subject.get("fuel") or "").lower(),
        str(subject.get("gearbox") or "").lower(),
        str(subject.get("body") or "").lower(),
    ]
    return "|".join(parts)[:120]


def compose_metrics(
    subject: dict[str, Any],
    active_comps: list[dict[str, Any]],
    lifecycle_comps: list[dict[str, Any]],
    *,
    stage: str = "preliminary",
) -> dict[str, Any]:
    """Собирает строку метрик из subject, активных и снятых аналогов.

    `lifecycle_comps` уже отфильтрованы SQL по свежести и `detection_lag`;
    здесь только считаем статистику и честно понижаем уверенность, если
    продаж-кандидатов мало.
    """
    analysis = analyse_price(subject, active_comps)
    flags: list[str] = []
    if analysis is None:
        flags.append("no_price_analysis")
    if stage == "preliminary":
        flags.append("preliminary")

    sold = [
        comp
        for comp in lifecycle_comps
        if comp.get("outcome") == "sold_candidate" and comp.get("dom_days") is not None
    ]
    dom_values = [float(comp["dom_days"]) for comp in sold]
    if not dom_values:
        flags.append("no_dom")
    elif len(dom_values) < 5:
        flags.append("few_dom")

    confidence = "low"
    if analysis is not None:
        confidence = analysis.get("confidence") or "low"
        if len(dom_values) < 5 and confidence == "high":
            # Цена надёжная, но срока продажи нет: не выдаём high за ликвидность.
            confidence = "medium"

    report = {
        "price": (analysis or {}).get("report"),
        "lifecycle": {
            "off_market": len(lifecycle_comps),
            "sold_candidates": len(sold),
            "dom_sample": len(dom_values),
        },
        "stage": stage,
    }
    return {
        "price": subject.get("price"),
        "estimate": (analysis or {}).get("median"),
        "base_median": (analysis or {}).get("report", {}).get("base_median"),
        "price_p10": (analysis or {}).get("p10"),
        "price_p90": (analysis or {}).get("p90"),
        "diff_pct": (analysis or {}).get("diff_pct"),
        "verdict": (analysis or {}).get("verdict", "unknown"),
        "confidence": confidence,
        "active_count": len(active_comps),
        "used_count": (analysis or {}).get("sample", 0),
        "avg_similarity": (analysis or {}).get("report", {}).get("avg_similarity"),
        "off_market_count": len(lifecycle_comps),
        "sold_candidate_count": len(sold),
        "dom_p25": _quantile(dom_values, 0.25),
        "dom_median": _quantile(dom_values, 0.5),
        "dom_p75": _quantile(dom_values, 0.75),
        "dom_sample": len(dom_values),
        "flags": flags,
        "report": report,
        "stage": stage,
        "segment_key": segment_key(subject),
    }


def _group(rows: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        item = dict(row)
        subject_id = item.pop("subject_id")
        grouped.setdefault(subject_id, []).append(item)
    return grouped


def analyze_listings(
    sink: Any,
    listing_ids: list[int],
    *,
    stage: str = "preliminary",
) -> int:
    """Считает и записывает метрики для указанных объявлений."""
    if not listing_ids:
        return 0
    from psycopg.rows import dict_row

    with sink.conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select id, make, model, price, year, mileage_km, engine_cm3,
                   power_hp, body, gearbox, drive, fuel, color, generation,
                   equipment, title
            from listing
            where id = any(%s::bigint[]) and status = 'active'
            """,
            (listing_ids,),
        )
        subjects = {row["id"]: dict(row) for row in cur.fetchall()}
        if not subjects:
            return 0
        cur.execute(ACTIVE_COMPS_SQL, {"ids": list(subjects)})
        active = _group(cur.fetchall())
        cur.execute(LIFECYCLE_COMPS_SQL, {"ids": list(subjects)})
        lifecycle = _group(cur.fetchall())

    now = datetime.now(UTC)
    values = []
    for listing_id, subject in subjects.items():
        metrics = compose_metrics(
            subject,
            active.get(listing_id, []),
            lifecycle.get(listing_id, []),
            stage=stage,
        )
        values.append(
            (
                listing_id,
                now,
                MODEL_VERSION,
                metrics["stage"],
                metrics["segment_key"],
                metrics["price"],
                metrics["estimate"],
                metrics["base_median"],
                metrics["price_p10"],
                metrics["price_p90"],
                metrics["diff_pct"],
                metrics["verdict"],
                metrics["confidence"],
                metrics["active_count"],
                metrics["used_count"],
                metrics["avg_similarity"],
                metrics["off_market_count"],
                metrics["sold_candidate_count"],
                metrics["dom_p25"],
                metrics["dom_median"],
                metrics["dom_p75"],
                metrics["dom_sample"],
                metrics["flags"],
                json.dumps(metrics["report"], ensure_ascii=False),
            )
        )

    with sink.conn.cursor() as cur:
        cur.executemany(
            """
            insert into listing_market_metric (
                listing_id, computed_at, model_version, stage, segment_key,
                price, estimate, base_median, price_p10, price_p90, diff_pct,
                verdict, confidence, active_count, used_count, avg_similarity,
                off_market_count, sold_candidate_count, dom_p25, dom_median,
                dom_p75, dom_sample, flags, report
            ) values (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
            )
            on conflict (listing_id) do update set
                computed_at = excluded.computed_at,
                model_version = excluded.model_version,
                stage = excluded.stage,
                segment_key = excluded.segment_key,
                price = excluded.price,
                estimate = excluded.estimate,
                base_median = excluded.base_median,
                price_p10 = excluded.price_p10,
                price_p90 = excluded.price_p90,
                diff_pct = excluded.diff_pct,
                verdict = excluded.verdict,
                confidence = excluded.confidence,
                active_count = excluded.active_count,
                used_count = excluded.used_count,
                avg_similarity = excluded.avg_similarity,
                off_market_count = excluded.off_market_count,
                sold_candidate_count = excluded.sold_candidate_count,
                dom_p25 = excluded.dom_p25,
                dom_median = excluded.dom_median,
                dom_p75 = excluded.dom_p75,
                dom_sample = excluded.dom_sample,
                flags = excluded.flags,
                report = excluded.report
            """,
            values,
        )
    sink.conn.commit()
    return len(values)


def analyze_external_ids(
    sink: Any,
    source: str,
    external_ids: list[str],
    *,
    stage: str = "preliminary",
) -> int:
    """Обёртка для только что вставленных объявлений из watch."""
    if not external_ids:
        return 0
    with sink.conn.cursor() as cur:
        cur.execute(
            """
            select l.id
            from listing l join source s on s.id = l.source_id
            where s.code = %s and l.external_id = any(%s) and l.status = 'active'
            """,
            (source, external_ids),
        )
        ids = [row[0] for row in cur.fetchall()]
    return analyze_listings(sink, ids, stage=stage)


def analyze_recent(sink: Any, limit: int = 50, *, stage: str = "final") -> int:
    """Бэкфилл для последних активных объявлений (CLI/ручная проверка)."""
    with sink.conn.cursor() as cur:
        cur.execute(
            """
            select id from listing
            where status = 'active'
            order by first_seen_at desc
            limit %s
            """,
            (max(1, limit),),
        )
        ids = [row[0] for row in cur.fetchall()]
    return analyze_listings(sink, ids, stage=stage)
