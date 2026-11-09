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

    -- хэш канонических полей: по нему понимаем, менялось ли что-то
    content_hash  text not null,
    updated_at    timestamptz not null default now(),

    unique (source_id, external_id)
);

-- Догоняющие колонки для уже существующих баз
alter table listing add column if not exists details_fetched_at timestamptz;

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

-- Для графиков «сколько собрано за день/месяц»
create index if not exists listing_first_seen_idx
    on listing (first_seen_at);

-- Очередь обогащения: объявления без карточки
create index if not exists listing_needs_details_idx
    on listing (first_seen_at) where details_fetched_at is null and status = 'active';

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

alter table app_user     enable row level security;
alter table subscription enable row level security;
alter table favorite     enable row level security;

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
    updated_at  timestamptz not null default now()
);

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

    return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: по умолчанию всё закрыто, доступ только у владельца/сервисной роли
-- ---------------------------------------------------------------------------

alter table source        enable row level security;
alter table listing       enable row level security;
alter table listing_event enable row level security;
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
    listing_id bigint primary key references listing(id) on delete cascade,
    views      integer not null default 0,
    likes      integer not null default 0,
    reposts    integer not null default 0,
    comments   integer not null default 0,
    score      numeric not null default 0,
    updated_at timestamptz not null default now()
);

create index if not exists listing_stat_score_idx on listing_stat (score desc);

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
