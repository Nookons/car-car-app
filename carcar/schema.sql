-- CarCar: каноническая схема для всех площадок.
--
-- Принципы (главное — не забивать базу мусором):
--   * один набор полей для любого источника; площадочные особенности не тащим;
--   * уникальность (source_id, external_id) — повторный сбор не создаёт дублей;
--   * history пишется ТОЛЬКО при изменении цены/статуса, не на каждом опросе;
--   * сырой JSON и HTML не храним (это и есть основной мусор);
--   * описания не храним — они не нужны для фильтра/уведомления;
--   * фото — только URL, не больше 8, без байтов;
--   * у отклонённых записей — отдельный журнал с автоочисткой;
--   * RLS включён: anon/authenticated по умолчанию не видят ничего.

begin;

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Источники
-- ---------------------------------------------------------------------------

create table if not exists source (
    id          smallint generated always as identity primary key,
    code        text not null unique,
    name        text not null,
    base_url    text not null,
    enabled     boolean not null default true,
    created_at  timestamptz not null default now()
);

insert into source (code, name, base_url) values
    ('otomoto', 'Otomoto', 'https://www.otomoto.pl'),
    ('olx',     'OLX',     'https://www.olx.pl')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Объявления
-- ---------------------------------------------------------------------------

create table if not exists listing (
    id            bigint generated always as identity primary key,
    source_id     smallint not null references source(id) on delete restrict,
    external_id   text not null,
    url           text not null,
    title         text not null,
    price         numeric(12, 0) not null check (price > 0),
    currency      char(3) not null default 'PLN',

    make          text,
    model         text,
    year          smallint check (year is null or (year between 1950 and 2030)),
    mileage_km    integer check (mileage_km is null or (mileage_km >= 0 and mileage_km < 2_000_000)),
    fuel          text check (fuel is null or fuel in
                    ('petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric',
                     'lpg', 'cng', 'other')),
    gearbox       text check (gearbox is null or gearbox in
                    ('manual', 'automatic', 'semi_auto', 'other')),
    body          text,
    power_hp      smallint check (power_hp is null or (power_hp between 10 and 2000)),
    engine_cm3    integer check (engine_cm3 is null or (engine_cm3 between 600 and 10_000)),
    color         text,
    vin           text check (vin is null or length(vin) = 17),

    city          text,
    region        text,
    lat           double precision check (lat is null or (lat between -90 and 90)),
    lon           double precision check (lon is null or (lon between -180 and 180)),

    seller_type   text check (seller_type is null or seller_type in ('private', 'dealer', 'unknown')),
    seller_name   text,

    thumb_url     text,
    photos        text[] not null default '{}',
    photos_count  smallint not null default 0,
    -- когда по объявлению скачали карточку (фото, кузов, цвет, продавец)
    details_fetched_at timestamptz,

    published_at  timestamptz,
    first_seen_at timestamptz not null default now(),
    last_seen_at  timestamptz not null default now(),
    status        text not null default 'active' check (status in ('active', 'removed')),
    -- когда объявление подтверждённо ушло из выдачи; null — ещё не снимали
    removed_at    timestamptz,
    -- сколько полных обходов подряд объявление не встречалось: 2 → removed
    missed_sweeps smallint not null default 0,

    -- хэш канонических полей: по нему понимаем, менялось ли что-то
    content_hash  text not null,
    updated_at    timestamptz not null default now(),

    unique (source_id, external_id)
);

-- Догоняющие колонки для уже существующих баз
alter table listing add column if not exists details_fetched_at timestamptz;
alter table listing add column if not exists removed_at timestamptz;
alter table listing add column if not exists missed_sweeps smallint not null default 0;

-- Индексы только под реальные запросы (лента, фильтры, гео).
create index if not exists listing_active_published_idx
    on listing (published_at desc) where status = 'active';

create index if not exists listing_active_price_idx
    on listing (price) where status = 'active';

create index if not exists listing_make_model_idx
    on listing (make, model) where status = 'active';

create index if not exists listing_geo_idx
    on listing (lat, lon) where status = 'active' and lat is not null;

create index if not exists listing_last_seen_idx
    on listing (last_seen_at) where status = 'active';

-- Подтверждение снятий: «активные, которых не видели в этом проходе»
create index if not exists listing_active_source_last_seen_idx
    on listing (source_id, last_seen_at) where status = 'active';

-- Снятые: кто давно не подтверждался и сколько проходов пропустил
create index if not exists listing_active_missed_idx
    on listing (source_id, missed_sweeps) where status = 'active';

-- Для графиков «сколько собрано за день/месяц»
create index if not exists listing_first_seen_idx
    on listing (first_seen_at);

-- Очередь обогащения: объявления без карточки
create index if not exists listing_needs_details_idx
    on listing (first_seen_at) where details_fetched_at is null and status = 'active';

-- ---------------------------------------------------------------------------
-- Предрасчитанная статистика рынка для лент и фильтров.
-- Пересобирается из активных объявлений: carcar refresh-market или
-- автоматически раз в 6 часов в watch (см. DatabaseSink.refresh_market).
-- ---------------------------------------------------------------------------

create table if not exists model_option (
    make         text not null,
    model        text not null,
    gearbox      text not null default '',
    fuel         text not null default '',
    body         text not null default '',
    listings     integer not null default 0,
    year_min     integer,
    year_max     integer,
    price_p10    integer,
    price_median integer,
    price_p90    integer,
    updated_at   timestamptz not null default now(),
    primary key (make, model, gearbox, fuel, body)
);

create index if not exists model_option_make_idx on model_option (make, model);

-- ---------------------------------------------------------------------------
-- История: только изменения, а не каждый опрос
-- ---------------------------------------------------------------------------

create table if not exists listing_event (
    id          bigint generated always as identity primary key,
    listing_id  bigint not null references listing(id) on delete cascade,
    kind        text not null check (kind in ('price_drop', 'price_up', 'removed', 'restored')),
    old_price   numeric(12, 0),
    new_price   numeric(12, 0),
    observed_at timestamptz not null default now()
);

create index if not exists listing_event_listing_idx
    on listing_event (listing_id, observed_at desc);

-- ---------------------------------------------------------------------------
-- «Индекс ушедших»: лёгкий снимок снятого объявления.
--
-- Переживает carcar_purge(): полная строка listing с фото удаляется, а
-- характеристики, цены и dom_days остаются. listing_id — без FK: архив
-- должен жить дольше объявления. Пишем только подтверждённые снятия
-- (removed_at is not null), чтобы админское «скрыть» не попало в статистику.
-- ---------------------------------------------------------------------------

create table if not exists listing_lifecycle (
    listing_id        bigint primary key,
    source_id         smallint not null,
    external_id       text not null,

    make              text,
    model             text,
    year              smallint,
    mileage_km        integer,
    fuel              text,
    gearbox           text,
    body              text,
    power_hp          smallint,
    engine_cm3        integer,
    drive             text,
    generation        text,
    color             text,
    city              text,
    region            text,
    seller_type       text,

    first_price       numeric(12, 0),
    last_price        numeric(12, 0),
    currency          char(3) not null default 'PLN',
    price_changes     integer not null default 0,
    -- signed: минус — подешевело до снятия
    price_change_pct  numeric(6, 2),

    published_at      timestamptz,
    first_seen_at     timestamptz not null,
    last_seen_at      timestamptz not null,
    removed_at        timestamptz not null,

    -- нижняя оценка срока на рынке: до последнего наблюдения, а не до
    -- конца sweep; точность ограничена интервалом полного обхода
    dom_days          numeric(8, 2) not null,
    dom_basis         text not null check (dom_basis in ('published_at', 'first_seen_at')),
    removal_kind      text not null check (removal_kind in
                          ('disappeared', 'gone_404', 'legacy')),
    -- эвристика: площадка не отдаёт «продано», поэтому отделяем истечение
    -- 30-дневного размещения от кандидата в продажу
    outcome           text not null default 'unknown' check (outcome in
                          ('sold_candidate', 'expired', 'unknown')),
    outcome_reason    text,
    -- сколько прошло между последним наблюдением и подтверждением снятия;
    -- > 1 дня — старая запись, dom_days только нижняя оценка
    detection_lag_days numeric(8, 2) not null default 0
                          check (detection_lag_days >= 0),

    details_fetched_at timestamptz,
    created_at        timestamptz not null default now()
);

create index if not exists listing_lifecycle_vehicle_idx
    on listing_lifecycle (make, model, year);
create index if not exists listing_lifecycle_removed_idx
    on listing_lifecycle (removed_at desc);
create index if not exists listing_lifecycle_source_idx
    on listing_lifecycle (source_id, removed_at desc);
create index if not exists listing_lifecycle_outcome_idx
    on listing_lifecycle (outcome, removed_at desc);
create index if not exists listing_lifecycle_stale_idx
    on listing_lifecycle (detection_lag_days) where detection_lag_days > 0;

-- Вернувшееся объявление (relist/restore) больше не считается снятым.
create or replace function cleanup_restored_listing() returns trigger
language plpgsql
as $$
begin
    if new.status = 'active' and old.status = 'removed' then
        delete from listing_lifecycle where listing_id = new.id;
    end if;
    return new;
end;
$$;

drop trigger if exists listing_restored_cleanup on listing;
create trigger listing_restored_cleanup
after update of status on listing
for each row execute function cleanup_restored_listing();

-- ---------------------------------------------------------------------------
-- Рыночные метрики по объявлению: одна текущая строка.
-- ---------------------------------------------------------------------------

create table if not exists listing_market_metric (
    listing_id      bigint primary key references listing(id) on delete cascade,
    computed_at     timestamptz not null default now(),
    model_version   smallint not null,
    stage           text not null default 'preliminary'
                        check (stage in ('preliminary', 'final')),
    segment_key     text not null,

    price           numeric(12, 0),
    estimate        numeric(12, 0),
    base_median     numeric(12, 0),
    price_p10       numeric(12, 0),
    price_p90       numeric(12, 0),
    diff_pct        numeric(6, 2),
    verdict         text check (verdict in ('below', 'fair', 'above', 'unknown')),
    confidence      text check (confidence in ('low', 'medium', 'high')),

    active_count    integer not null default 0,
    used_count      integer not null default 0,
    avg_similarity  numeric(5, 2),

    off_market_count     integer not null default 0,
    sold_candidate_count integer not null default 0,
    dom_p25         numeric(6, 1),
    dom_median      numeric(6, 1),
    dom_p75         numeric(6, 1),
    dom_sample      integer not null default 0,

    flags           text[] not null default '{}',
    report          jsonb not null default '{}'::jsonb
);

create index if not exists listing_market_metric_segment_idx
    on listing_market_metric (segment_key, computed_at desc);
create index if not exists listing_market_metric_computed_idx
    on listing_market_metric (computed_at desc);

-- ---------------------------------------------------------------------------
-- Наблюдаемость и отбракованные записи
-- ---------------------------------------------------------------------------

create table if not exists crawl_run (
    id          bigint generated always as identity primary key,
    source_id   smallint not null references source(id) on delete cascade,
    started_at  timestamptz not null default now(),
    finished_at timestamptz,
    pages       integer not null default 0,
    items       integer not null default 0,
    inserted    integer not null default 0,
    updated     integer not null default 0,
    unchanged   integer not null default 0,
    rejected    integer not null default 0,
    errors      integer not null default 0,
    notes       text
);

create index if not exists crawl_run_source_idx on crawl_run (source_id, started_at desc);

-- Сюда попадает всё, что не прошло валидацию: без сырого payload, только причина.
create table if not exists ingest_reject (
    id          bigint generated always as identity primary key,
    source_id   smallint references source(id) on delete set null,
    external_id text,
    reason      text not null,
    created_at  timestamptz not null default now()
);

create index if not exists ingest_reject_created_idx on ingest_reject (created_at desc);

-- ---------------------------------------------------------------------------
-- Пользователи Telegram Mini App
-- ---------------------------------------------------------------------------

create table if not exists app_user (
    id           bigint generated always as identity primary key,
    tg_id        bigint not null unique,
    username     text,
    first_name   text,
    last_name    text,
    lang         text not null default 'ru' check (lang in ('ru', 'pl', 'uk', 'en')),
    notify_new   boolean not null default true,
    notify_price boolean not null default true,
    digest       boolean not null default false,
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

-- снижение цены в избранном — отдельный тумблер (как и notify_new)
alter table app_user add column if not exists notify_price boolean not null default true;

-- Веб-версия: вход по e-mail/паролю и телефону рядом с Telegram Mini App.
-- tg_id больше не обязателен, но хотя бы один идентификатор должен быть.
alter table app_user alter column tg_id drop not null;
alter table app_user add column if not exists email text;
alter table app_user add column if not exists email_verified_at timestamptz;
alter table app_user add column if not exists phone text;
alter table app_user add column if not exists phone_verified_at timestamptz;
alter table app_user add column if not exists password_hash text;
alter table app_user add column if not exists auth_version integer not null default 0;

create unique index if not exists app_user_email_key
    on app_user (lower(email)) where email is not null;
create unique index if not exists app_user_phone_key
    on app_user (phone) where phone is not null;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'app_user_identity_check'
    ) then
        alter table app_user add constraint app_user_identity_check
            check (tg_id is not null or email is not null or phone is not null);
    end if;
end $$;

-- Способы входа: один человек — один app_user, но несколько identity
-- (Telegram, Google, Facebook, GitHub). Уникальна пара provider+subject:
-- один и тот же Google-аккаунт не может быть привязан к двум людям.
create table if not exists user_identity (
    id            bigint generated always as identity primary key,
    user_id       bigint not null references app_user(id) on delete cascade,
    provider      text not null,
    subject       text not null,
    email         text,
    created_at    timestamptz not null default now(),
    last_login_at timestamptz not null default now(),
    unique (provider, subject)
);
create index if not exists user_identity_user_idx on user_identity (user_id);
create index if not exists user_identity_email_idx
    on user_identity (lower(email)) where email is not null;

-- Уже существующие Telegram-аккаунты сразу становятся identity.
insert into user_identity (user_id, provider, subject)
select id, 'telegram', tg_id::text from app_user where tg_id is not null
on conflict (provider, subject) do nothing;

create table if not exists subscription (
    id         bigint generated always as identity primary key,
    user_id    bigint not null references app_user(id) on delete cascade,
    name       text not null,
    criteria   jsonb not null,
    active     boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists subscription_user_idx on subscription (user_id) where active;

create table if not exists favorite (
    user_id    bigint not null references app_user(id) on delete cascade,
    listing_id bigint not null references listing(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, listing_id)
);

-- Шортлист — не просто «сердечко»: у машины есть статус и заметка.
alter table favorite add column if not exists status text not null default 'shortlist';
alter table favorite add column if not exists note text;
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'favorite_status_check'
    ) then
        alter table favorite add constraint favorite_status_check
            check (status in ('shortlist', 'contacted', 'viewed', 'rejected', 'bought'));
    end if;
end $$;

-- События продукта. Общие события не содержат сырого текста; для авторизованного
-- поиска kind='search' содержит query/filters в meta, связанные с user_id.
-- Срок таких данных ограничен 400 днями функцией carcar_purge().
create table if not exists funnel_event (
    id         bigint generated always as identity primary key,
    user_id    bigint references app_user(id) on delete set null,
    visitor_id uuid not null,
    kind       text not null check (kind in
                 ('visit', 'search', 'listing_view', 'favorite_add',
                  'favorite_update', 'saved_search', 'alert_open', 'share',
                  'onboarding_start', 'onboarding_step', 'onboarding_done')),
    listing_id bigint references listing(id) on delete set null,
    meta       jsonb,
    created_at timestamptz not null default now()
);
create index if not exists funnel_event_kind_idx
    on funnel_event (kind, created_at desc);
create index if not exists funnel_event_visitor_idx
    on funnel_event (visitor_id, created_at desc);
create index if not exists funnel_event_user_idx
    on funnel_event (user_id, created_at desc) where user_id is not null;

-- Daily, privacy-preserving product activity aggregates. No raw search text,
-- IP addresses, or device identifiers are stored here.
create table if not exists user_activity_daily (
    user_id bigint not null references app_user(id) on delete cascade,
    day date not null default current_date,
    sessions integer not null default 0,
    searches integer not null default 0,
    listing_views integer not null default 0,
    favorites_added integer not null default 0,
    subscriptions_created integer not null default 0,
    last_session_at timestamptz,
    last_search_at timestamptz,
    last_active_at timestamptz not null default now(),
    primary key (user_id, day)
);
create index if not exists user_activity_daily_day_idx
    on user_activity_daily (day desc, user_id);
alter table user_activity_daily enable row level security;
revoke all privileges on table public.user_activity_daily from anon, authenticated;

alter table app_user     enable row level security;
alter table subscription enable row level security;
alter table favorite     enable row level security;

-- Одна строка — одна активная cookie-сессия. В базе только SHA-256 токена:
-- утечка дампа не даёт войти. CSRF-токен привязан к сессии тем же хешем.
create table if not exists web_session (
    id           bigint generated always as identity primary key,
    user_id      bigint not null references app_user(id) on delete cascade,
    token_hash   text not null unique,
    csrf_hash    text not null,
    user_agent   text,
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    expires_at   timestamptz not null,
    revoked_at   timestamptz
);

create index if not exists web_session_user_idx
    on web_session (user_id) where revoked_at is null;
create index if not exists web_session_expires_idx on web_session (expires_at);

-- Одноразовые ссылки и SMS-коды. token_hash — для писем, code_hash — для
-- телефона; у кода дополнительно хранится число неудачных попыток.
create table if not exists auth_token (
    id           bigint generated always as identity primary key,
    user_id      bigint not null references app_user(id) on delete cascade,
    kind         text not null check (kind in
                    ('email_verify', 'email_change', 'password_reset',
                     'phone_verify', 'phone_login', 'telegram_link')),
    destination  text not null,
    token_hash   text,
    code_hash    text,
    attempts     integer not null default 0,
    expires_at   timestamptz not null,
    consumed_at  timestamptz,
    created_at   timestamptz not null default now()
);

create index if not exists auth_token_token_idx
    on auth_token (kind, token_hash) where token_hash is not null;
create index if not exists auth_token_destination_idx
    on auth_token (kind, destination, created_at desc);
create index if not exists auth_token_expires_idx on auth_token (expires_at);

-- Живая база получила таблицу до появления email_change/telegram_link:
-- пересобираем ограничение, не теряя данные.
alter table auth_token drop constraint if exists auth_token_kind_check;
alter table auth_token add constraint auth_token_kind_check check (kind in
    ('email_verify', 'email_change', 'password_reset',
     'phone_verify', 'phone_login', 'telegram_link'));

alter table web_session  enable row level security;
alter table auth_token   enable row level security;
alter table user_identity enable row level security;
alter table funnel_event enable row level security;

-- ---------------------------------------------------------------------------
-- Состояние коллекторов (на Railway у каждого свой контейнер и нет общего диска)
-- ---------------------------------------------------------------------------

create table if not exists collector (
    source_id        smallint primary key references source(id) on delete cascade,
    status           text not null default 'unknown',
    heartbeat_at     timestamptz,
    interval_seconds integer not null default 60,
    round            integer not null default 0,
    last_poll_at     timestamptz,
    last_error       text,
    stats            jsonb not null default '{}'::jsonb,
    paused           boolean not null default false,
    paused_reason    text,
    paused_at        timestamptz,
    updated_at       timestamptz not null default now()
);

create table if not exists sweep_state (
    source_id   smallint primary key references source(id) on delete cascade,
    next_page   integer not null default 1,
    total_pages integer,
    inserted    integer not null default 0,
    updated     integer not null default 0,
    -- граница «видели в этом проходе»; по ней считается missed_sweeps
    pass_started_at timestamptz,
    completed_at    timestamptz,
    last_pages      integer,
    last_errors     integer,
    updated_at  timestamptz not null default now()
);

-- Догоняющие колонки для уже существующих баз
alter table sweep_state add column if not exists pass_started_at timestamptz;
alter table sweep_state add column if not exists completed_at timestamptz;
alter table sweep_state add column if not exists last_pages integer;
alter table sweep_state add column if not exists last_errors integer;

alter table collector    enable row level security;
alter table sweep_state  enable row level security;

-- ---------------------------------------------------------------------------
-- Очистка: чтобы база не росла бесконечно
-- ---------------------------------------------------------------------------

create or replace function carcar_purge(retention_days integer default 30)
returns table (removed_listings bigint, old_runs bigint, old_rejects bigint, old_events bigint)
language plpgsql
as $$
begin
    -- Перед удалением полной строки сохраняем «Индекс ушедших»: характеристики,
    -- первую/последнюю цену и срок на рынке. listing_lifecycle не имеет FK,
    -- поэтому переживает удаление объявления.
    with expired as (
        select l.id, l.source_id, l.external_id, l.make, l.model, l.year,
               l.mileage_km, l.fuel, l.gearbox, l.body, l.power_hp, l.engine_cm3,
               l.drive, l.generation, l.color, l.city, l.region, l.seller_type,
               l.price as last_price, l.currency, l.published_at, l.first_seen_at,
               l.last_seen_at, l.removed_at, l.details_fetched_at,
               coalesce((
                   select e.old_price from listing_event e
                   where e.listing_id = l.id and e.kind in ('price_drop', 'price_up')
                   order by e.observed_at asc limit 1
               ), l.price) as first_price,
               (select count(*)::int from listing_event e
                where e.listing_id = l.id and e.kind in ('price_drop', 'price_up')) as price_changes
        from listing l
        where l.status = 'removed'
          and l.removed_at is not null
          and l.last_seen_at < now() - make_interval(days => retention_days)
          and not exists (select 1 from listing_lifecycle x where x.listing_id = l.id)
    )
    insert into listing_lifecycle (
        listing_id, source_id, external_id, make, model, year, mileage_km,
        fuel, gearbox, body, power_hp, engine_cm3, drive, generation, color,
        city, region, seller_type, first_price, last_price, currency,
        price_changes, price_change_pct, published_at, first_seen_at,
        last_seen_at, removed_at, dom_days, dom_basis, removal_kind,
        details_fetched_at
    )
    select
        id, source_id, external_id, make, model, year, mileage_km,
        fuel, gearbox, body, power_hp, engine_cm3, drive, generation, color,
        city, region, seller_type, first_price, last_price, currency,
        price_changes,
        case when first_price > 0
             then round((last_price - first_price)::numeric / first_price * 100, 2)
        end,
        published_at, first_seen_at, last_seen_at, removed_at,
        round(greatest(0, extract(epoch from (
            last_seen_at - case
                when published_at is not null and published_at <= first_seen_at
                then published_at else first_seen_at
            end
        )) / 86400)::numeric, 2),
        case when published_at is not null and published_at <= first_seen_at
             then 'published_at' else 'first_seen_at' end,
        'legacy',
        details_fetched_at
    from expired
    on conflict (listing_id) do nothing;

    -- Снятые объявления живут ещё месяц (могут понадобиться для истории цены).
    delete from listing
    where status = 'removed' and last_seen_at < now() - make_interval(days => retention_days);
    get diagnostics removed_listings = row_count;

    delete from crawl_run where started_at < now() - interval '90 days';
    get diagnostics old_runs = row_count;

    delete from ingest_reject where created_at < now() - interval '30 days';
    get diagnostics old_rejects = row_count;

    delete from listing_event where observed_at < now() - interval '180 days';
    get diagnostics old_events = row_count;

    -- «Индекс ушедших» — двухлетняя история; дальше это уже не метрика,
    -- а балласт. Снимок лёгкий: без фото, описаний и JSON.
    delete from listing_lifecycle where removed_at < now() - interval '730 days';

    -- Воронка обезличена, но и ей нужен срок: 400 дней хватает для годовых
    -- когорт, дальше это уже не метрика, а балласт.
    delete from funnel_event where created_at < now() - interval '400 days';

    return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: по умолчанию всё закрыто, доступ только у владельца/сервисной роли
-- ---------------------------------------------------------------------------

alter table source        enable row level security;
alter table listing       enable row level security;
alter table listing_event enable row level security;
alter table listing_lifecycle enable row level security;
alter table listing_market_metric enable row level security;
alter table crawl_run     enable row level security;
alter table ingest_reject enable row level security;

commit;

-- описание объявления (краткое, без HTML) для карточки
alter table listing add column if not exists description text;

-- расширенные характеристики карточки
alter table listing
    add column if not exists version             text,
    add column if not exists generation          text,
    add column if not exists doors               smallint,
    add column if not exists seats               smallint,
    add column if not exists drive               text,
    add column if not exists condition           text,
    add column if not exists co2_gkm             smallint,
    add column if not exists consumption_urban   numeric(4,1),
    add column if not exists consumption_extra   numeric(4,1),
    add column if not exists equipment           text[];

-- уведомления: new — по подписке, price_drop — падение цены в избранном.
-- Одна строка на пару user+listing: price_drop переиспользует её и
-- перезаписывает payload, поэтому старый сервис продолжает работать.
create table if not exists notification (
    id         bigint generated always as identity primary key,
    user_id    bigint not null references app_user(id) on delete cascade,
    listing_id bigint not null references listing(id) on delete cascade,
    kind       text not null default 'new',
    payload    jsonb,
    status     text not null default 'pending'
               check (status in ('pending', 'sent', 'failed')),
    attempts   int not null default 0,
    created_at timestamptz not null default now(),
    sent_at    timestamptz,
    unique (user_id, listing_id)
);

create index if not exists notification_pending_idx
    on notification (status) where status = 'pending';

alter table notification add column if not exists kind text not null default 'new';
alter table notification add column if not exists payload jsonb;

-- гарантии доставки: повторы и мёртвая очередь
alter table notification add column if not exists next_attempt_at timestamptz not null default now();
alter table notification add column if not exists last_error text;
alter table notification add column if not exists telegram_message_id bigint;
alter table notification drop constraint if exists notification_status_check;
alter table notification add constraint notification_status_check
    check (status in ('pending', 'sent', 'failed', 'held', 'dead'));
create index if not exists notification_retry_idx
    on notification (status, next_attempt_at) where status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- Просмотры, реакции, комментарии и популярность
-- ---------------------------------------------------------------------------

create table if not exists listing_stat (
    listing_id  bigint primary key references listing(id) on delete cascade,
    views       integer not null default 0,
    impressions integer not null default 0,
    favorites   integer not null default 0,
    likes       integer not null default 0,
    reposts     integer not null default 0,
    comments    integer not null default 0,
    score       numeric not null default 0,
    updated_at  timestamptz not null default now()
);

alter table listing_stat add column if not exists impressions integer not null default 0;
alter table listing_stat add column if not exists favorites   integer not null default 0;

create index if not exists listing_stat_score_idx on listing_stat (score desc);

-- Одна формула интереса на всё приложение. Показ — «увидел», просмотр —
-- «открыл», избранное — «сохранил себе». Слагаемые под логарифмом гасят
-- раскрутку, а CTR отличает открытие от простого показа.
create or replace function listing_engagement_score(
    p_views integer,
    p_impressions integer,
    p_favorites integer,
    p_likes integer,
    p_comments integer,
    p_reposts integer
) returns numeric
language sql
immutable
parallel safe
as $$
    select round((
        ln(
            1
            + greatest(coalesce(p_views, 0), 0)
            + 5 * greatest(coalesce(p_favorites, 0), 0)
            + 2 * greatest(coalesce(p_likes, 0), 0)
            + 3 * greatest(coalesce(p_comments, 0), 0)
            + 4 * greatest(coalesce(p_reposts, 0), 0)
        )
        + 4.0 * (greatest(coalesce(p_views, 0), 0) + 1)
              / (greatest(coalesce(p_impressions, 0), 0) + 10)
    )::numeric, 4);
$$;

-- score пишет только база: у любого писателя одна и та же арифметика.
create or replace function listing_stat_recalc_score() returns trigger
language plpgsql
as $$
begin
    new.score := listing_engagement_score(
        new.views, new.impressions, new.favorites, new.likes, new.comments, new.reposts
    );
    return new;
end;
$$;

drop trigger if exists listing_stat_score on listing_stat;
create trigger listing_stat_score
    before insert or update of views, impressions, favorites, likes, comments, reposts
    on listing_stat
    for each row execute function listing_stat_recalc_score();

-- Избранное считает база: код, каскадное удаление и ручная чистка одинаково
-- проходят через один счётчик.
create or replace function favorite_stat_counter() returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        insert into listing_stat (listing_id, favorites)
        values (new.listing_id, 1)
        on conflict (listing_id) do update set
            favorites = listing_stat.favorites + 1,
            updated_at = now();
        return new;
    elsif tg_op = 'DELETE' then
        update listing_stat set
            favorites = greatest(favorites - 1, 0),
            updated_at = now()
        where listing_id = old.listing_id;
        return old;
    end if;
    return null;
end;
$$;

drop trigger if exists favorite_stat_counter on favorite;
create trigger favorite_stat_counter
    after insert or delete on favorite
    for each row execute function favorite_stat_counter();

create table if not exists listing_view (
    user_id    bigint not null references app_user(id) on delete cascade,
    listing_id bigint not null references listing(id) on delete cascade,
    day        date not null default current_date,
    created_at timestamptz not null default now(),
    primary key (user_id, listing_id, day)
);

create table if not exists listing_reaction (
    user_id    bigint not null references app_user(id) on delete cascade,
    listing_id bigint not null references listing(id) on delete cascade,
    kind       text not null check (kind in ('like', 'repost')),
    created_at timestamptz not null default now(),
    primary key (user_id, listing_id, kind)
);

create table if not exists listing_comment (
    id         bigint generated always as identity primary key,
    user_id    bigint not null references app_user(id) on delete cascade,
    listing_id bigint not null references listing(id) on delete cascade,
    text       text not null check (char_length(text) between 1 and 1000),
    created_at timestamptz not null default now()
);

create index if not exists listing_comment_listing_idx
    on listing_comment (listing_id, created_at desc);

-- The application is accessed through FastAPI; do not expose CarCar tables
-- directly through Supabase's anon/authenticated Data API roles.
revoke all privileges on schema public from public, anon, authenticated;
alter table listing_comment enable row level security;
alter table listing_reaction enable row level security;
alter table listing_stat enable row level security;
alter table listing_view enable row level security;
alter table model_option enable row level security;
alter table notification enable row level security;

revoke all privileges on table
    public.source,
    public.listing,
    public.model_option,
    public.listing_event,
    public.crawl_run,
    public.ingest_reject,
    public.app_user,
    public.subscription,
    public.favorite,
    public.web_session,
    public.auth_token,
    public.user_identity,
    public.funnel_event,
    public.collector,
    public.sweep_state,
    public.notification,
    public.listing_stat,
    public.listing_view,
    public.listing_reaction,
    public.listing_comment
from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public
    revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated;

-- Cursor pagination for support notification history.
create index if not exists notification_user_history_idx on notification (user_id, id desc);

-- Includes legacy records incorrectly marked complete without photographs.
create index if not exists listing_detail_recovery_idx
    on listing (source_id, first_seen_at, id)
    where status = 'active' and (details_fetched_at is null or coalesce(photos_count,0) = 0);
