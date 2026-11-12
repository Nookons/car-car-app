# Telegram Mini App и веб-версия

Фронтенд: **Next.js 15 (App Router) + Tailwind + shadcn-стиль + Phosphor Icons**.
Хостинг: **Vercel**. API и бот: отдельные сервисы на **Railway**.

```
Telegram                         Обычный браузер
   │ initData (HMAC-подпись)          │ e-mail/телефон + пароль
   ▼                                 ▼
Next.js на Vercel ──► FastAPI (Railway) ──► Supabase Postgres
        ▲                    ▲
        └──── бот @CarCarFinderBot (кнопка меню)
```

Приложение одно, но у него **два независимых входа**. Разделяет их не флаг,
присланный клиентом, а наличие подписанного `initData`:

| Как открыто | Вход | Что меняется |
|---|---|---|
| Через Telegram | `initData` → HMAC-проверка → JWT | ничего, прежний путь |
| Обычный браузер | e-mail/телефон + пароль, cookie-сессия | полноценный веб-аккаунт |

Флаг «я из Telegram» от клиента ничего не решает: без валидной HMAC-подписи
`initData` сервер его не примет. Именно поэтому разделение нельзя обойти,
подменив значение в браузере.

## Экраны

| Экран | Что делает |
|---|---|
| `/` главная | поиск, приветствие, быстрые фильтры (включая «За сутки»), марки с логотипами, 6 свежих объявлений |
| `/list` список | текстовый поиск, фильтры (марка, цена, год, пробег, топливо, КПП, радиус), свежесть, сортировки, пагинация, счётчик |
| `/listing/[id]` | галерея фото, цена и отчёт по рынку, отметка о снижении цены, баннер «снято с продажи», характеристики, продавец, похожие объявления, избранное, ссылка на otomoto |
| `/account` | профиль (Telegram или веб), контакты и их подтверждение, язык, уведомления, сохранённые фильтры, избранное |
| `/login`, `/register` | вход по e-mail/телефону и паролю, регистрация |
| `/login/phone` | вход по телефону одноразовым SMS-кодом |
| `/verify-email` | переход по ссылке из письма |
| `/forgot-password`, `/reset-password` | восстановление пароля по ссылке |
| `/onboarding` | 3 шага: марка/бюджет → детали → сохранённый поиск и демо-алерт |
| `/share/[id]` | публичная share-карточка с OG-картинкой |
| `/privacy`, `/terms` | политика конфиденциальности и условия (шаблон для беты) |

Скриншоты: `docs/img/mini-*.png`, а также новые состояния —
`docs/img/home-search.png`, `docs/img/list-search.png`,
`docs/img/card-price-history.png`, гостевой аккаунт —
`docs/img/guest-account-telegram.png`.

## Авторизация

### Telegram (не изменилась)

1. Фронт берёт `Telegram.WebApp.initData` и отправляет на `POST /api/auth`.
2. API проверяет HMAC-SHA256 подпись секретом бота и `auth_date` (24 ч).
3. В ответ — JWT на 30 дней; дальше запросы идут с `Authorization: Bearer`.

Dev-вход (`init_data: "dev"`) работает **только** при `CARCAR_ALLOW_DEV=1`
и заданном `CARCAR_DEV_TG_ID` — в проде выключен.

### Веб-версия

1. Пароль хранится только как **scrypt-хеш** (`N=2^15, r=8, p=1`, соль 16 байт).
   В БД нет ни пароля, ни его обратимого представления.
2. Вход создаёт **httpOnly-cookie** `carcar_session`; в таблице `web_session`
   лежит только SHA-256 от токена. Срок — 30 дней, выход отзывает сессию.
3. Изменяющие запросы с cookie требуют `X-CSRF-Token`; токен лежит в читаемой
   cookie `carcar_csrf`, его хеш привязан к сессии. Для Bearer (Telegram)
   проверка не нужна.
4. Регистрация присылает письмо со ссылкой подтверждения (24 ч). Ссылка
   одноразовая, в БД — только её хеш. Без подтверждения аккаунт работает, но
   адрес помечен неподтверждённым, и в профиле висит напоминание.
5. Телефон подтверждается шестизначным кодом (10 мин, 5 попыток); после
   подтверждения телефон годится и для входа без пароля.
6. Восстановление пароля — одноразовая ссылка на час; после смены пароля все
   cookie-сессии пользователя отзываются.
7. Вход/регистрация/коды ограничены rate limit'ом (по логину, телефону и IP).

Почта уходит через SMTP (`CARCAR_SMTP_*`), SMS — через HTTP-webhook
(`CARCAR_SMS_WEBHOOK_URL`, тело `{"to": "+48...", "text": "..."}`). Если
доставка не настроена, в dev сообщение пишется в лог, в проде — только
предупреждение без кода и ссылки.

### Связанные входы (Telegram ↔ веб)

Один `app_user` может иметь несколько identity: Telegram, Google, Facebook,
GitHub. Таблица `user_identity` хранит пару `provider + subject`; `tg_id`
остаётся для совместимости и быстрых запросов бота.

| Сценарий | Как работает |
|---|---|
| Telegram-аккаунт на сайте | Login Widget → `POST /api/auth/telegram/web` → тот же `app_user`, cookie-сессия |
| Веб-аккаунт в Telegram | «Способы входа» → «Привязать Telegram» → deep link `t.me/<bot>?start=link_<token>` → бот привязывает `tg_id` к веб-аккаунту |
| Telegram-аккаунт на сайте по паролю | «Способы входа» → добавить почту → подтвердить → установить пароль → обычный вход по e-mail |
| Google/Facebook/GitHub | OAuth 2.0 → identity; если почта подтверждена провайдером и такой `app_user` уже есть, identity привязывается к нему, иначе создаётся новый аккаунт |

Ограничение: одна identity — один аккаунт. Если Telegram уже привязан к другому
`app_user`, бот ответит отказом; войдите через Telegram в тот аккаунт. Слияние
двух аккаунтов со своими избранными/фильтрами — отдельная задача, автоматически
оно не делается.

**Telegram Login Widget** требует, чтобы у бота был прописан домен:
`@BotFather → /setdomain → <домен сайта>`. Без этого виджет не отрисуется;
отключить его можно `CARCAR_TELEGRAM_WIDGET=0`, оставив привязку через бота.

**OAuth-провайдеры** включаются наличием пары env. Redirect URI (его нужно
добавить в консоли провайдера):

```
https://<фронт>/api/auth/oauth/google/callback
https://<фронт>/api/auth/oauth/facebook/callback
https://<фронт>/api/auth/oauth/github/callback
```

### Один origin для cookie

Фронт зовёт свой `/api`, а Next проксирует его в FastAPI (`rewrites` в
`next.config.mjs`). Это делает cookie **first-party**: Safari и Chrome иначе
режут cookie между `vercel.app` и `railway.app`. Прямой вызов API с другого
домена для cookie-входа не поддерживается — только через прокси.

## Переменные

### Vercel (фронт)

| Переменная | Значение |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api>.up.railway.app` — цель прокси `/api` |
| `NEXT_PUBLIC_TELEGRAM_BOT` | `CarCarFinderBot` — username бота для гостевой кнопки «Открыть в Telegram» |
| `NEXT_PUBLIC_SITE_URL` | `https://<фронт>` — база для OG-картинок и метаданных |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | контакт для RODO-запросов |

Root Directory на Vercel — корень репозитория (Next.js лежит в корне, рядом с Python-бэкендом). Framework — Next.js.

### Railway (API)

| Переменная | Значение |
|---|---|
| `CARCAR_MODE` | `miniapp` |
| `DATABASE_URL` | Session pooler Supabase |
| `CARCAR_BOT_TOKEN` | токен бота |
| `CARCAR_JWT_SECRET` | случайная строка (≠ токен) |
| `CARCAR_CORS_ORIGINS` | `https://<проект>.vercel.app` |
| `CARCAR_PUBLIC_URL` | `https://<проект>.vercel.app` — ссылки в письмах |
| `CARCAR_COOKIE_SAMESITE` | `lax` — при прокси Next этого достаточно |
| `CARCAR_TRUST_PROXY` | `1` за Railway/Vercel: брать IP из `X-Forwarded-For` для rate limit |
| `CARCAR_COOKIE_SECURE` | `auto` — HTTPS определяется по запросу |
| `CARCAR_SMTP_HOST` | SMTP-сервер (Resend, Postmark, SES, Gmail) |
| `CARCAR_SMTP_PORT` | `587` (или `465` для SSL) |
| `CARCAR_SMTP_USER` / `CARCAR_SMTP_PASSWORD` | логин SMTP |
| `CARCAR_SMTP_FROM` | адрес отправителя, например `CarCar <no-reply@…>` |
| `CARCAR_SMS_WEBHOOK_URL` | HTTP-шлюз SMS; принимает `{"to", "text"}` |
| `CARCAR_SMS_WEBHOOK_TOKEN` | Bearer-токен для шлюза (необязательно) |
| `CARCAR_BOT_USERNAME` | username бота для deep link привязки (`CarCarFinderBot`) |
| `CARCAR_TELEGRAM_WIDGET` | `1` — показывать Login Widget; `0` — только привязка через бота |
| `CARCAR_GOOGLE_CLIENT_ID` / `CARCAR_GOOGLE_CLIENT_SECRET` | Google OAuth |
| `CARCAR_FACEBOOK_CLIENT_ID` / `CARCAR_FACEBOOK_CLIENT_SECRET` | Facebook OAuth |
| `CARCAR_GITHUB_CLIENT_ID` / `CARCAR_GITHUB_CLIENT_SECRET` | GitHub OAuth |

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

Для локальной проверки **веб-входа** ничего дополнительно не нужно: откройте
`/register`, письмо уйдёт в лог API, ссылка появится в ответе как
`dev_verification_token` (только при `CARCAR_ALLOW_DEV=1`). SMS-код в dev тоже
возвращается в `dev_code` и пишется в лог.

Для проверки **Telegram-входа** без Telegram: `CARCAR_ALLOW_DEV=1` в `.env` и
`?tg_dev=1` в URL (при `NEXT_PUBLIC_ALLOW_DEV=1`). Обычный браузер без этого
флага остаётся веб-режимом — иначе нельзя было бы тестировать пароли локально.

## Сборка

```bash
pnpm build && pnpm start
```

На этом Mac нативный SWC не загружается из-за проверки подписи (Team ID),
поэтому в репозитории включены `@next/swc-wasm-nodejs` и `node-linker=hoisted`
(`.npmrc`). На Vercel это не нужно — там обычный linux-бинарь.

## API-контракт

```
POST /api/auth              {init_data} → {token, user}        Telegram
POST /api/auth/register     {email, password, name?} → {user}  + cookie
POST /api/auth/login        {login, password} → {user}         + cookie
POST /api/auth/logout       отзыв cookie-сессии
GET  /api/auth/session      кто я по cookie (или 401)
POST /api/auth/verify-email {token}
POST /api/auth/email/resend повторное письмо (нужна сессия)
POST /api/auth/password/forgot {email}
POST /api/auth/password/reset  {token, password}
POST /api/auth/phone/start     {phone} → SMS-код (нужна сессия)
POST /api/auth/phone/verify    {phone, code}
POST /api/auth/phone/login     {phone} → SMS-код
POST /api/auth/phone/login/verify {phone, code} → {user} + cookie
GET  /api/auth/providers    какие способы входа настроены
GET  /api/auth/oauth/{provider}/start    → redirect к провайдеру
GET  /api/auth/oauth/{provider}/callback → cookie-сессия или привязка
POST /api/auth/telegram/web         данные Login Widget → cookie-сессия
POST /api/auth/telegram/link/start  deep link для привязки Telegram
GET  /api/auth/identities           привязанные способы входа
POST /api/auth/email/start          {email} → письмо для смены почты
POST /api/auth/password/set         {password} — если пароля ещё нет
POST /api/events            обезличенное событие воронки
GET  /api/admin/funnel      воронка визит → поиск → сохранённый поиск → алерт
GET  /api/favorites/{id}    статус и заметка шортлиста
PATCH /api/favorites/{id}   {status?, note?}
POST /api/subscriptions/{id}/demo  демо-алерт (в Telegram, если привязан)
GET  /api/account/export    экспорт данных (RODO)
DELETE /api/account         удаление аккаунта (RODO)
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

## План 2027: воронка и первые 14 дней

Клиентские события воронки не содержат IP, поисковых фраз или заметок.
Отдельно для авторизованных поисков `funnel_event` хранит фразу и фильтры,
связанные с `user_id`; координаты округляются до двух знаков. Эти записи
доступны только администратору, включены в экспорт и удаляются вместе с
аккаунтом. Срок хранения — 400 дней, чистится `carcar_purge()`.

Онбординг: `/onboarding` → выбор марки/бюджета → детали → `POST /subscriptions`
→ `POST /subscriptions/{id}/demo`. Если Telegram привязан, демо уходит
сообщением; иначе показывается превью и предложение привязать Telegram.

Шортлист: `favorite.status` (`shortlist/contacted/viewed/rejected/bought`) и
`favorite.note`. Редактируется в карточке и в аккаунте.

Share-карточка: `/share/[id]` с OG-картинкой; кнопка «Поделиться» в карточке
ведёт на неё. В боте включён inline-режим: `@CarCarFinderBot bmw 320` отдаёт
до пяти карточек. Для этого у BotFather нужно включить `/setinline`.

RODO: `/privacy`, `/terms`, экспорт (`/api/account/export`) и удаление
(`DELETE /api/account`) — в аккаунте, раздел «Данные и аккаунт».

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

Уведомления сейчас доставляются **только в Telegram**. Веб-аккаунт получает
избранное, фильтры и настройки; чтобы получать алерты, привяжите Telegram в
«Способах входа» — тогда у аккаунта появится `tg_id` и он попадёт в очередь.
Чисто почтовых алертов пока нет: доставка писем по подпискам — следующий этап.
Аккаунты без `tg_id` в очередь Telegram не попадают (`u.tg_id is not null`),
а не ломают её.
