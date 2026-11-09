# Telegram Mini App

Фронтенд: **Next.js 15 (App Router) + Tailwind + shadcn-стиль + Phosphor Icons**.
Хостинг: **Vercel**. API и бот: отдельные сервисы на **Railway**.

```
Telegram
   │ initData (HMAC-подпись)
   ▼
Next.js на Vercel ──► FastAPI (Railway) ──► Supabase Postgres
        ▲                    ▲
        └──── бот @CarCarFinderBot (кнопка меню)
```

## Экраны

| Экран | Что делает |
|---|---|
| `/` главная | поиск, приветствие, быстрые фильтры (включая «За сутки»), марки с логотипами, 6 свежих объявлений |
| `/list` список | текстовый поиск, фильтры (марка, цена, год, пробег, топливо, КПП, радиус), свежесть, сортировки, пагинация, счётчик |
| `/listing/[id]` | галерея фото, цена и отчёт по рынку, отметка о снижении цены, баннер «снято с продажи», характеристики, продавец, похожие объявления, избранное, ссылка на otomoto |
| `/account` | профиль Telegram, язык, уведомления, сохранённые фильтры, избранное |

Скриншоты: `docs/img/mini-*.png`, а также новые состояния —
`docs/img/home-search.png`, `docs/img/list-search.png`,
`docs/img/card-price-history.png`, гостевой аккаунт —
`docs/img/guest-account-telegram.png`.

## Авторизация

1. Фронт берёт `Telegram.WebApp.initData` и отправляет на `POST /api/auth`.
2. API проверяет HMAC-SHA256 подпись секретом бота и `auth_date` (24 ч).
3. В ответ — JWT на 30 дней; дальше запросы идут с `Authorization: Bearer`.

Паролей нет. Dev-вход (`init_data: "dev"`) работает **только** при
`CARCAR_ALLOW_DEV=1` и заданном `CARCAR_DEV_TG_ID` — в проде выключен.

## Переменные

### Vercel (фронт)

| Переменная | Значение |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api>.up.railway.app` |
| `NEXT_PUBLIC_TELEGRAM_BOT` | `CarCarFinderBot` — username бота для гостевой кнопки «Открыть в Telegram» |

Root Directory на Vercel — корень репозитория (Next.js лежит в корне, рядом с Python-бэкендом). Framework — Next.js.

### Railway (API)

| Переменная | Значение |
|---|---|
| `CARCAR_MODE` | `miniapp` |
| `DATABASE_URL` | Session pooler Supabase |
| `CARCAR_BOT_TOKEN` | токен бота |
| `CARCAR_JWT_SECRET` | случайная строка (≠ токен) |
| `CARCAR_CORS_ORIGINS` | `https://<проект>.vercel.app` |

### Бот

Бот работает **через вебхук**, а не поллинг: два поллера с одним токеном
конфликтуют (`Conflict: terminated by other getUpdates request`), поэтому
вебхук — единственный надёжный вариант. Отдельный сервис не нужен.

Переменные API:

| Переменная | Значение |
|---|---|
| `CARCAR_BOT_TOKEN` | токен бота |
| `CARCAR_PUBLIC_URL` | `https://<проект>.vercel.app` |
| `CARCAR_API_URL` | `https://<api>.up.railway.app` |
| `CARCAR_WEBHOOK_SECRET` | случайная строка |

При старте API сам вызывает `setWebhook` на `/bot/webhook` (с проверкой
`X-Telegram-Bot-Api-Secret-Token`) и ставит кнопку меню, в том числе для
уже существующих чатов.

## Разработка

```bash
# API
.venv/bin/python -m carcar miniapp --port 8080

# фронт
pnpm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:8080 pnpm dev   # http://localhost:3000
```

Для локальной проверки без Telegram: `CARCAR_ALLOW_DEV=1` в `.env`, затем
эмулировать `window.Telegram.WebApp.initData = "dev"` в консоли браузера.

## Сборка

```bash
pnpm build && pnpm start
```

На этом Mac нативный SWC не загружается из-за проверки подписи (Team ID),
поэтому в репозитории включены `@next/swc-wasm-nodejs` и `node-linker=hoisted`
(`.npmrc`). На Vercel это не нужно — там обычный linux-бинарь.

## API-контракт

```
POST /api/auth              {init_data} → {token, user}
GET  /api/me                профиль
PATCH /api/me               {lang?, notify_new?, notify_price?, digest?}
GET  /api/listings          limit, offset, q, make, price_min/max, year_min/max,
                            mileage_max, fuel, gearbox, source, published_days,
                            lat, lon, radius_km; sort: new|price_asc|price_desc|
                            distance|year_desc|mileage_asc
GET  /api/listings/{id}     карточка
GET  /api/listings/{id}/similar  похожие (limit 1..12, кэш 10 мин)
GET/POST /api/subscriptions
PATCH/DELETE /api/subscriptions/{id}
GET/POST/DELETE /api/favorites
```

## История цены

Строится из `listing_event`: стартовая цена — `old_price` первого изменения
(момент — `first_seen_at`), затем каждое изменение и текущая цена. Показывается
на карточке, только если цена реально менялась; в блоке видны дата, новая цена,
направление и сумма изменения, а сверху — итог «с момента наблюдения».

## Уведомления о снижении цены

Сборщик замечает изменение цены, пишет `listing_event` и публикует в шину
событие `listing.price_drop` с `old_price`/`new_price`. Воркер находит всех,
у кого эта машина в избранном и включён `notify_price`, и отправляет сообщение
«было → стало, −N%» с фото и кнопкой в приложение.

- в уведомлении о новом объявлении есть оценка рынка тем же `analyse_price`,
  что на карточке: «ниже рынка на N% · медиана X zł»;
- тумблер «Снижение цены в избранном» — в аккаунте, по умолчанию включён;
- дедуп: одна строка `notification` на пару user+listing, в `payload` лежат
  старая и новая цена; повтор той же цены не отправляется, следующее
  снижение перезаписывает payload;
- ошибки отправки уходят в общий `retry_due` с тем же backoff, что и новые
  объявления; дайджест их не забирает — снижение цены срочное.
