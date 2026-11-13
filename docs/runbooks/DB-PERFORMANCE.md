# Runbook: перегрузка Postgres / фоновый конвейер

## Текущее состояние

- `enricher`, `enricher2`, `collector`, `worker` остановлены: БД стабилизирована.
- API, Vercel и dashboard работают; сайт отдаёт уже собранные объявления.
- Причина: market metrics в `runner.py` (26-секундный self-join на каждый лот)
  и live market в `notify.py` (8.9 с на уведомление). Таблица
  `listing_market_metric` при этом никем не читается.
- В коде оба тяжёлых пути теперь **выключены по умолчанию**:
  - `CARCAR_MARKET_METRICS=0` — не считать market metrics в watch/enrich;
  - `CARCAR_NOTIFY_MARKET=0` — не делать live-расчёт рынка в уведомлениях.
- API-пул уменьшен до 4 (`CARCAR_DB_POOL_MAX`, по умолчанию 4), checkout timeout 10 с.

## P0: поднять compute Supabase

Nano → **Small** минимум, лучше **Medium**:

1. Supabase Dashboard → Project Settings → Infrastructure → Primary Database.
2. Upgrade/Modify compute.
3. Дождаться статуса Running; проверить CPU/RAM/connections.

Без этого возвращать enricher'ы нельзя.

## Применить индексы

Миграция: [`db/migrations/20261113_market_perf.sql`](../../db/migrations/20261113_market_perf.sql).

`CONCURRENTLY` нельзя запускать в транзакции. Применить statement'ами при
остановленном конвейере:

```bash
set -a; . ./.env.supabase; set +a
.venv/bin/python - <<'PY'
import os, psycopg
c = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True, prepare_threshold=None)
for sql in [
    "create index concurrently if not exists listing_market_comps_idx on listing (make, model, year, mileage_km) where status = 'active' and price is not null",
    "create index concurrently if not exists listing_active_city_idx on listing (city) where status = 'active' and city is not null and lat is not null and lon is not null",
]:
    with c.cursor() as cur:
        cur.execute(sql)
c.close()
PY
```

Если пулер не даёт `CONCURRENTLY` — применить те же `CREATE INDEX` без
`CONCURRENTLY` при остановленном конвейере (это заблокирует запись на время
построения, но не чтение).

## Health-check

```bash
set -a; . ./.env.supabase; set +a
.venv/bin/python scripts/db_health.py
.venv/bin/python scripts/db_health.py --json
```

Смотреть: CPU/RAM в Supabase, `active_queries_over_5s`, `temp_bytes`,
heartbeat collector, `needs_details`, `market_metric_rows`.

## Возврат сервисов

Только после апгрейда compute и проверки health. По одному:

```bash
# 1. Один enricher
railway service redeploy -s enricher -e production --from-source -y
# подождать 10-15 минут, проверить CPU/pool timeout/health
# 2. Второй enricher
railway service redeploy -s enricher2 -e production --from-source -y
# 3. Collector
railway service redeploy -s collector -e production --from-source -y
# 4. Worker
railway service redeploy -s worker -e production --from-source -y
```

Если снова `ECHECKOUTTIMEOUT` / CPU > 80% / растёт `temp_bytes`:

```bash
railway down -s enricher -e production -y
railway down -s enricher2 -e production -y
railway down -s collector -e production -y
railway down -s worker -e production -y
```

## Что ещё не сделано

- Materialized views/кэш для `filter_cities`, `filter_makes`, `filter_options`.
- Чтение `listing_market_metric` в карточке/ленте (иначе таблица не нужна).
- Отдельный batch-джоб market metrics вместо горячего пути.
- Алерты в Telegram по `db_health.py` (сейчас скрипт для cron/Railway).
