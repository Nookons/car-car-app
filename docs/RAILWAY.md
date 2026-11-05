# Деплой коллекторов на Railway

Каждая площадка — **отдельный сервис**, независимый от остальных. Общий у них
только один образ и одна база: Supabase.

## Как устроено

```
Railway                          Supabase (Postgres)
┌──────────────────────┐         ┌─────────────────────────────┐
│ collector-otomoto    │  SQL    │ listing, listing_event      │
│   CARCAR_MODE=watch  │────────►│ crawl_run, ingest_reject    │
├──────────────────────┤         │ collector  (heartbeat/пауза)│
│ enricher-otomoto     │────────►│ sweep_state (прогресс)      │
│   CARCAR_MODE=enrich │         └─────────────────────────────┘
├──────────────────────┤                    ▲
│ sweeper-otomoto      │────────────────────┘
│   CARCAR_MODE=sweep  │
├──────────────────────┤
│ dashboard            │  читает базу, показывает все коллекторы
│   CARCAR_MODE=dashboard
└──────────────────────┘
```

Состояние (heartbeat, пауза, прогресс обхода) живёт **в базе**, а не на диске —
контейнеры Railway можно перезапускать и масштабировать без потерь.

## Сервисы

| Сервис | `CARCAR_MODE` | `CARCAR_SOURCE` | Что делает |
|---|---|---|---|
| `collector-otomoto` | `watch` | `otomoto` | опрос выдачи раз в минуту, карточки новинок |
| `enricher-otomoto` | `enrich` | `otomoto` | догружает фото/кузов/цвет/продавца |
| `sweeper-otomoto` | `sweep` | `otomoto` | полный обход рынка (можно запускать по cron) |
| `dashboard` | `dashboard` | — | веб-дашборд на `$PORT` |

## Переменные окружения

| Переменная | Обязательна | Значение |
|---|---|---|
| `DATABASE_URL` | да | Session pooler Supabase (`postgresql://postgres.<ref>:...@aws-0-<region>.pooler.supabase.com:5432/postgres`) |
| `CARCAR_MODE` | да | `watch` / `enrich` / `sweep` / `dashboard` |
| `CARCAR_SOURCE` | для коллекторов | `otomoto` (пока единственный реализованный парсер) |
| `CARCAR_INTERVAL` | нет | секунды между опросами, по умолчанию 60 |
| `CARCAR_DETAILS` | нет | сколько карточек за опрос, по умолчанию 3 |
| `CARCAR_RPS` | нет | темп обхода для `sweep`, по умолчанию 0.7 |
| `CARCAR_ENRICH_LIMIT` | нет | сколько карточек за прогон обогащения |
| `PORT` | для dashboard | Railway подставляет сам |

## Порядок деплоя

1. **Схема** — один раз, можно локально:
   ```bash
   DATABASE_URL='postgresql://...' .venv/bin/python scripts/apply_schema.py
   ```
   Создаёт `source`, `listing`, `listing_event`, `crawl_run`, `ingest_reject`,
   `collector`, `sweep_state`.

2. **Проект на Railway** → *New Project* → *Deploy from GitHub repo* (или
   `railway up` из этой папки). Сборка — по `Dockerfile`, политика
   перезапуска — `ON_FAILURE` (см. `railway.json`).

3. **Сервис коллектора**: Variables → `DATABASE_URL`, `CARCAR_MODE=watch`,
   `CARCAR_SOURCE=otomoto`. Deploy.

4. **Сервис обогащения**: те же переменные, `CARCAR_MODE=enrich`.

5. **Sweep**: `CARCAR_MODE=sweep`. Можно держать постоянно — после завершения
   он выходит, а Railway перезапускает; прогресс в `sweep_state`, так что
   повторный запуск продолжит с места. Но лучше — Railway Cron раз в сутки.

6. **Дашборд**: `CARCAR_MODE=dashboard`, `DATABASE_URL`. Публичный домен
   Railway даёт сам; порт берётся из `$PORT`.

## Проверка

```sql
select s.code, c.status, c.heartbeat_at, c.paused, c.stats
from collector c join source s on s.id = c.source_id;
```

Дашборд показывает таблицу «Коллекторы»: статус, последний опрос, новых,
ошибок и кнопку паузы **для каждой площадки отдельно**.

Пауза из CLI:

```bash
.venv/bin/python -m carcar pause --source otomoto --reason "чиним парсер"
.venv/bin/python -m carcar resume --source otomoto
```

## Добавление новой площадки

1. Парсер: модуль, который превращает страницу площадки в `Listing`
   (канонические поля — [`carcar/canonical.py`](../carcar/canonical.py)).
2. Строка в `source` (`code`, `name`, `base_url`).
3. Новый сервис на Railway с `CARCAR_SOURCE=<code>`.

Схему и дашборд менять **не нужно** — они уже мультиплатформенные.

## Что важно помнить

- Контейнеры ничего не пишут на диск: логи — в stdout (Railway их собирает),
  состояние — в базе.
- `DATABASE_URL` — только Session pooler (5432): прямой `db.<ref>.supabase.co`
  работает лишь по IPv6.
- Sweep на 0.7 req/s проходит ~8 000 страниц за ~3 часа; одновременный запуск
  watch + enrich + sweep — это ~1.5 req/s, площадка это терпит, но при 503
  коллекторы сами притормаживают и ставят паузу после серии ошибок.
