-- CarCar — черновик схемы v0.1 (PostgreSQL 16)
--
-- Принципы:
--  * listing  — объявление на конкретной площадке;
--    vehicle  — кластер «один и тот же автомобиль» (может объединять объявления
--               с нескольких площадок и перевыставления у одного дилера).
--  * история append-only: listing_snapshot пишется ТОЛЬКО при изменении.
--  * никаких ON DELETE CASCADE на историю — только SET NULL / RESTRICT.
--  * объявления не удаляются физически: status + last_seen_at.
--
-- Это черновик для обсуждения, а не миграция. Финальные имена/типы могут
-- поменяться после фазы 1.

begin;

-- ---------------------------------------------------------------------------
-- Справочники
-- ---------------------------------------------------------------------------

create table source (
    id            smallint generated always as identity primary key,
    code          text not null unique,          -- 'otomoto', 'olx', 'allegro'
    name          text not null,
    base_url      text not null,
    enabled       boolean not null default true,
    config        jsonb not null default '{}'::jsonb,  -- лимиты, селекторы, фичи
    created_at    timestamptz not null default now()
);

create table make (
    id        integer generated always as identity primary key,
    name      text not null unique,              -- 'BMW', 'Mercedes-Benz'
    slug      text not null unique
);

create table model (
    id        integer generated always as identity primary key,
    make_id   integer not null references make(id) on delete restrict,
    name      text not null,                     -- 'Seria 3', 'Klasa C'
    slug      text not null,
    body_type text,
    unique (make_id, slug)
);

-- Алиасы площадок: 'bmw' / 'BMW' / 'БМВ' → одна марка.
create table make_alias (
    alias   text primary key,                    -- нормализованная строка
    make_id integer not null references make(id) on delete cascade
);

create table model_alias (
    alias    text primary key,
    model_id integer not null references model(id) on delete cascade
);

create table seller (
    id           bigint generated always as identity primary key,
    source_id    smallint not null references source(id) on delete restrict,
    external_id  text,                            -- id продавца на площадке
    kind         text not null check (kind in ('private', 'dealer', 'unknown')),
    name         text,                            -- для дилеров; частных не публикуем
    city         text,
    region       text,
    profile_url  text,
    created_at   timestamptz not null default now(),
    unique (source_id, external_id)
);

-- ---------------------------------------------------------------------------
-- Объявления
-- ---------------------------------------------------------------------------

create table listing (
    id               bigint generated always as identity primary key,
    source_id        smallint not null references source(id) on delete restrict,
    external_id      text not null,
    url              text not null,
    title            text,
    description      text,                        -- сокращённо, с ссылкой на оригинал
    price_amount     numeric(12, 0),
    currency         char(3) not null default 'PLN',
    published_at     timestamptz,                 -- createdAt площадки
    updated_at_src   timestamptz,                 -- updatedAt площадки
    first_seen_at    timestamptz not null default now(),
    last_seen_at     timestamptz not null default now(),
    removed_at       timestamptz,
    status           text not null default 'active'
                     check (status in ('active', 'removed', 'hidden')),
    seller_id        bigint references seller(id) on delete set null,
    vehicle_id       bigint,                      -- FK ниже, после создания vehicle
    source_category  text,                        -- 'osobowe', 'dostawcze'
    raw              jsonb not null default '{}'::jsonb,
    unique (source_id, external_id)
);

create index listing_vehicle_idx      on listing (vehicle_id);
create index listing_status_seen_idx  on listing (status, last_seen_at desc);
create index listing_published_idx    on listing (published_at desc) where status = 'active';
create index listing_price_idx        on listing (price_amount) where status = 'active';
create index listing_raw_gin          on listing using gin (raw jsonb_path_ops);

-- История изменений: цена, пробег, заголовок, статус. Только дельты.
create table listing_snapshot (
    id            bigint generated always as identity primary key,
    listing_id    bigint not null references listing(id) on delete cascade,
    observed_at   timestamptz not null default now(),
    price_amount  numeric(12, 0),
    mileage_km    integer,
    title_hash    text,
    status        text,
    reason        text not null
                  check (reason in ('created', 'price', 'mileage', 'title', 'status', 'manual'))
);

create index snapshot_listing_idx on listing_snapshot (listing_id, observed_at desc);

create table listing_photo (
    id         bigint generated always as identity primary key,
    listing_id bigint not null references listing(id) on delete cascade,
    position   smallint not null,
    url        text not null,
    phash      bit(64),                           -- перцептивный хэш для дедупа
    unique (listing_id, position)
);

create index photo_phash_idx on listing_photo (phash) where phash is not null;

-- ---------------------------------------------------------------------------
-- Автомобиль (кластер объявлений)
-- ---------------------------------------------------------------------------

create table vehicle (
    id              bigint generated always as identity primary key,
    make_id         integer references make(id) on delete restrict,
    model_id        integer references model(id) on delete restrict,
    generation      text,
    year            smallint,
    fuel            text check (fuel in ('petrol', 'diesel', 'hybrid', 'phev', 'electric', 'lpg', 'cng', 'other')),
    gearbox         text check (gearbox in ('manual', 'automatic', 'semi_auto', 'other')),
    body            text,
    power_hp        smallint,
    engine_cm3      integer,
    mileage_km      integer,
    vin             text,
    color           text,
    doors           smallint,
    seats           smallint,
    drive           text,
    country_origin  text,
    -- нормализованный отпечаток для дедупа без VIN
    fingerprint     text,
    first_seen_at   timestamptz not null default now(),
    created_at      timestamptz not null default now()
);

create index vehicle_vin_idx   on vehicle (vin) where vin is not null;
create index vehicle_fp_idx    on vehicle (fingerprint);
create index vehicle_cohort_idx on vehicle (make_id, model_id, year, fuel, gearbox);
create index vehicle_mileage_idx on vehicle (mileage_km);

alter table listing
    add constraint listing_vehicle_fkey
    foreign key (vehicle_id) references vehicle(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Оценка рынка (пересчитывается ночью, не на каждый запрос)
-- ---------------------------------------------------------------------------

create table price_stat (
    id              bigint generated always as identity primary key,
    make_id         integer not null references make(id) on delete cascade,
    model_id        integer references model(id) on delete cascade,
    year_from       smallint not null,
    year_to         smallint not null,
    fuel            text,
    gearbox         text,
    sample_n        integer not null,
    median_price    numeric(12, 0) not null,
    p25_price       numeric(12, 0),
    p75_price       numeric(12, 0),
    mad_price       numeric(12, 0),               -- медианное абсолютное отклонение
    -- наклон поправки на пробег: цена падает на slope_per_10k за каждые 10 тыс. км
    slope_per_10k   numeric(12, 2),
    computed_at     timestamptz not null default now(),
    unique (make_id, model_id, year_from, year_to, fuel, gearbox)
);

-- ---------------------------------------------------------------------------
-- Пользователи, подписки, уведомления
-- ---------------------------------------------------------------------------

create table app_user (
    id          bigint generated always as identity primary key,
    tg_id       bigint not null unique,
    username    text,
    first_name  text,
    lang        text not null default 'pl' check (lang in ('pl', 'ru', 'uk', 'en')),
    role        text not null default 'user' check (role in ('user', 'admin')),
    created_at  timestamptz not null default now(),
    last_seen_at timestamptz
);

create table subscription (
    id            bigint generated always as identity primary key,
    user_id       bigint not null references app_user(id) on delete cascade,
    name          text not null,
    active        boolean not null default true,
    mode          text not null default 'instant' check (mode in ('instant', 'digest')),
    quiet_hours   int4range,                     -- например '[23,7)' по часам Варшавы
    -- критерии в jsonb: {"make":"bmw","model":"seria-3","price_max":45000,
    --                   "year_min":2015,"mileage_max":200000,"region":"mazowieckie",
    --                   "fuel":["diesel"],"deal_score_min":-15,"radius_km":50}
    criteria      jsonb not null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index subscription_active_idx on subscription (user_id) where active;
create index subscription_criteria_gin on subscription using gin (criteria jsonb_path_ops);

create table notification (
    id              bigint generated always as identity primary key,
    user_id         bigint not null references app_user(id) on delete cascade,
    subscription_id bigint references subscription(id) on delete set null,
    listing_id      bigint not null references listing(id) on delete cascade,
    kind            text not null check (kind in ('new', 'price_drop', 'deal', 'digest')),
    status          text not null default 'pending'
                    check (status in ('pending', 'sent', 'failed', 'skipped')),
    tg_message_id   bigint,
    error           text,
    created_at      timestamptz not null default now(),
    sent_at         timestamptz,
    unique (user_id, listing_id, kind)           -- одно объявление — один пуш
);

create index notification_pending_idx on notification (status, created_at) where status = 'pending';

create table favorite (
    user_id    bigint not null references app_user(id) on delete cascade,
    listing_id bigint not null references listing(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, listing_id)
);

-- ---------------------------------------------------------------------------
-- Наблюдаемость сбора
-- ---------------------------------------------------------------------------

create table crawl_run (
    id           bigint generated always as identity primary key,
    source_id    smallint not null references source(id) on delete cascade,
    kind         text not null check (kind in ('discovery', 'detail', 'sweep')),
    started_at   timestamptz not null default now(),
    finished_at  timestamptz,
    pages        integer not null default 0,
    items        integer not null default 0,
    created      integer not null default 0,
    changed      integer not null default 0,
    errors       integer not null default 0,
    error_sample text
);

create index crawl_run_source_idx on crawl_run (source_id, started_at desc);

-- Сид источников
insert into source (code, name, base_url) values
    ('otomoto', 'Otomoto', 'https://www.otomoto.pl'),
    ('olx',     'OLX',     'https://www.olx.pl');

commit;
