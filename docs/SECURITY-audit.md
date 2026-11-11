# Security review: CarCar production

Дата: 10.11.2026. Проверены исходники, текущая схема Supabase и доступные публичные HTTP-поверхности. Все SQL-проверки выполнялись в read-only транзакциях. DDL/данные production не изменялись.

## Срочные риски

### P0 — прямой доступ Supabase `anon` к служебным данным

Фактическая проверка под ролью `anon` подтвердила чтение таблиц без RLS: `notification` (538 строк), `listing_view` (71), `listing_reaction` (9), `listing_stat` (70) и `listing_comment` (1). В `notification` лежат внутренние user/listing ссылки и payload уведомлений; `listing_view` раскрывает историю просмотров. У `anon` и `authenticated` на этих таблицах выданы `SELECT/INSERT/UPDATE/DELETE`.

Дополнительно база выдаёт эти CRUD-права по умолчанию для новых таблиц в `public`; для новых функций по умолчанию разрешён `EXECUTE`. Существующая `carcar_purge(integer)` также разрешена к вызову `anon/authenticated`. На большинстве остальных CarCar таблиц RLS включён без политик и поэтому чтение через эти роли возвращает 0 строк.

Код фронтенда использует FastAPI, а не Supabase SDK, поэтому прямые grants не нужны. При обычной настройке Supabase Data API с exposed schema `public` эти права могут превратить таблицы в доступный через REST API интерфейс. На самой базе проверены права роли; фактический HTTP REST endpoint не проверялся, так как anon key не публиковался в репозитории.

Подготовлена миграция [20261110_lock_down_public_api.sql](/Users/nookon/Desktop/CarCar/db/migrations/20261110_lock_down_public_api.sql): отбирает `USAGE/CREATE` на `public` у PUBLIC/anon/authenticated, включает RLS на пользовательских/операционных таблицах, отзывает права клиентских ролей со всех таблиц/sequence/functions в `public` и убирает опасные default grants. Backend продолжает ходить владельцем схемы. Она **не применена к production**; будущим минимальным ролям сервисов после отдельного внедрения понадобится явный `USAGE` и точечные grants.

### P0 — приложение подключалось к БД как роль `postgres`

Текущая connection string в локальном конфиге использует `postgres`. Read-only каталог ролей подтвердил `BYPASSRLS`, `CREATEROLE` и `CREATEDB`; объекты CarCar принадлежат этой роли. API и другие процессы используют `DATABASE_URL`, поэтому компрометация любого из них даёт широкие права на базу и может обходить RLS.

Пароль владельца, присланный в чат, ротирован; новый пароль обновлён во всех Railway services и проверен повторным подключением. Подготовлена [миграция runtime-роли](</Users/nookon/Desktop/CarCar/db/migrations/20261111_create_runtime_role.sql>): отдельная роль без прав создавать БД/роли, с CRUD только на таблицы CarCar. До применения и переключения сервисов приложение ещё использует `postgres`. Локальный `.env.supabase` хранит административное подключение с правами `0600` и исключён из Git.

## Исправления в коде, подготовленные локально

- Telegram `initData` принимается только до 5 минут, отсутствующий/нечисловой `auth_date` и время более чем на 30 секунд из будущего отклоняются.
- Проверка JWT теперь валидирует заголовок HS256/JWT, `exp`, будущее `iat`, положительный `sub` и превращает некорректные токены в 401 вместо возможного 500.
- Production не стартует с JWT secret, совпадающим с bot token по fallback; требуется отдельный `CARCAR_JWT_SECRET`.
- Telegram webhook в production требует `CARCAR_WEBHOOK_SECRET` и отклоняет запросы при отсутствующем секрете.
- Vercel headers включают HSTS, `nosniff` и явную Referrer-Policy.

Изменения в репозитории ещё не развёрнуты. Долгоживущий JWT (30 дней) сохраняется в localStorage; для целевого уровня безопасности нужен отдельный refresh flow с ротацией, отзывом сессий и коротким access token. Сейчас refresh endpoint отсутствует, поэтому просто уменьшать TTL сломало бы активные сессии.

## Другие пробелы

- Rate limiting для API не реализован. Нужны Redis-backed лимиты на вход/запись и edge-защита для публичного каталога; IP-ключ надо брать только из доверенного Railway/edge proxy.
- В `POST /api/subscriptions` поле `criteria` — произвольный dict без ограничения размера/глубины; общая верхняя граница тела запроса не настроена.
- Нет CSP. Добавлять её следует с nonce для inline theme bootstrap и разрешениями для Telegram SDK, иначе можно сломать Mini App.
- Для `notification`, `listing_view`, `listing_reaction`, `listing_comment`, `listing_stat`, `model_option` RLS включается подготовленной миграцией без политик. Backend использует роль owner/BYPASSRLS, поэтому его поведение не меняется; прямые Supabase клиенты этих таблиц не используют.
- Railway deployment variables, service logs, build configuration, backups и edge rate limits не проверены из-за отсутствия Railway project access.

## Проверенная базовая позиция

- CORS preflight для `https://car-car-app.vercel.app` разрешён ожидаемыми методами и заголовками; wildcard origin не обнаружен.
- `CARCAR_MODE=dev` внешне не включался и Dev endpoint требует секрет; фактические Railway variables не доступны, поэтому production значения не подтверждены.
- SQL-запросы в `MiniAppRepo.search` параметризованы; SQL sort order выбран из фиксированной карты.
- Входящий webhook был fail-open в исходном коде при пустом секрете; локально заменён на fail-closed.
