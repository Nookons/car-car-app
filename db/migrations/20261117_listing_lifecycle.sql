-- «Индекс ушедших»: подтверждение снятий и история срока на рынке.
--
-- Что делает:
--   1. добавляет listing.removed_at / missed_sweeps и индексы под reconcile;
--   2. создаёт listing_lifecycle — лёгкий снимок снятого объявления,
--      который переживает carcar_purge();
--   3. добавляет в sweep_state точку старта и завершения полного прохода;
--   4. переносит уже снятые объявления в архив (removal_kind = 'legacy');
--   5. обновляет carcar_purge(): архив перед удалением полной строки.
--
-- Идемпотентно. Применять до запуска кода, который пишет removed_at.

begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- listing: признаки снятия
-- ---------------------------------------------------------------------------

alter table public.listing add column if not exists removed_at timestamptz;
alter table public.listing add column if not exists missed_sweeps smallint not null default 0;

create index if not exists listing_active_source_last_seen_idx
    on public.listing (source_id, last_seen_at) where status = 'active';
create index if not exists listing_active_missed_idx
    on public.listing (source_id, missed_sweeps) where status = 'active';

-- ---------------------------------------------------------------------------
-- Архив снятых
-- ---------------------------------------------------------------------------

create table if not exists public.listing_lifecycle (
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
    price_change_pct  numeric(6, 2),

    published_at      timestamptz,
    first_seen_at     timestamptz not null,
    last_seen_at      timestamptz not null,
    removed_at        timestamptz not null,

    dom_days          numeric(8, 2) not null,
    dom_basis         text not null check (dom_basis in ('published_at', 'first_seen_at')),
    removal_kind      text not null check (removal_kind in
                          ('disappeared', 'gone_404', 'legacy')),

    details_fetched_at timestamptz,
    created_at        timestamptz not null default now()
);

create index if not exists listing_lifecycle_vehicle_idx
    on public.listing_lifecycle (make, model, year);
create index if not exists listing_lifecycle_removed_idx
    on public.listing_lifecycle (removed_at desc);
create index if not exists listing_lifecycle_source_idx
    on public.listing_lifecycle (source_id, removed_at desc);

alter table public.listing_lifecycle enable row level security;
revoke all on public.listing_lifecycle from anon, authenticated;
grant select, insert, update, delete on public.listing_lifecycle to carcar_runtime;

-- ---------------------------------------------------------------------------
-- sweep_state: границы полного прохода
-- ---------------------------------------------------------------------------

alter table public.sweep_state add column if not exists pass_started_at timestamptz;
alter table public.sweep_state add column if not exists completed_at timestamptz;
alter table public.sweep_state add column if not exists last_pages integer;
alter table public.sweep_state add column if not exists last_errors integer;

-- ---------------------------------------------------------------------------
-- Старые снятые: датируем последним наблюдением и переносим в архив.
-- Это оценка задним числом (removal_kind = 'legacy'); новые снятия пишутся
-- точнее — с removed_at момента подтверждения.
-- ---------------------------------------------------------------------------

update public.listing
set removed_at = last_seen_at
where status = 'removed' and removed_at is null;

with expired as (
    select l.id, l.source_id, l.external_id, l.make, l.model, l.year,
           l.mileage_km, l.fuel, l.gearbox, l.body, l.power_hp, l.engine_cm3,
           l.drive, l.generation, l.color, l.city, l.region, l.seller_type,
           l.price as last_price, l.currency, l.published_at, l.first_seen_at,
           l.last_seen_at, l.removed_at, l.details_fetched_at,
           coalesce((
               select e.old_price from public.listing_event e
               where e.listing_id = l.id and e.kind in ('price_drop', 'price_up')
               order by e.observed_at asc limit 1
           ), l.price) as first_price,
           (select count(*)::int from public.listing_event e
            where e.listing_id = l.id and e.kind in ('price_drop', 'price_up')) as price_changes
    from public.listing l
    where l.status = 'removed'
      and l.removed_at is not null
      and not exists (select 1 from public.listing_lifecycle x where x.listing_id = l.id)
)
insert into public.listing_lifecycle (
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

-- ---------------------------------------------------------------------------
-- Очистка: архив перед удалением + срок жизни архива
-- ---------------------------------------------------------------------------

create or replace function public.carcar_purge(retention_days integer default 30)
returns table (removed_listings bigint, old_runs bigint, old_rejects bigint, old_events bigint)
language plpgsql
as $$
begin
    with expired as (
        select l.id, l.source_id, l.external_id, l.make, l.model, l.year,
               l.mileage_km, l.fuel, l.gearbox, l.body, l.power_hp, l.engine_cm3,
               l.drive, l.generation, l.color, l.city, l.region, l.seller_type,
               l.price as last_price, l.currency, l.published_at, l.first_seen_at,
               l.last_seen_at, l.removed_at, l.details_fetched_at,
               coalesce((
                   select e.old_price from public.listing_event e
                   where e.listing_id = l.id and e.kind in ('price_drop', 'price_up')
                   order by e.observed_at asc limit 1
               ), l.price) as first_price,
               (select count(*)::int from public.listing_event e
                where e.listing_id = l.id and e.kind in ('price_drop', 'price_up')) as price_changes
        from public.listing l
        where l.status = 'removed'
          and l.removed_at is not null
          and l.last_seen_at < now() - make_interval(days => retention_days)
          and not exists (select 1 from public.listing_lifecycle x where x.listing_id = l.id)
    )
    insert into public.listing_lifecycle (
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

    delete from public.listing
    where status = 'removed'
      and last_seen_at < now() - make_interval(days => retention_days);
    get diagnostics removed_listings = row_count;

    delete from public.crawl_run where started_at < now() - interval '90 days';
    get diagnostics old_runs = row_count;

    delete from public.ingest_reject where created_at < now() - interval '30 days';
    get diagnostics old_rejects = row_count;

    delete from public.listing_event where observed_at < now() - interval '180 days';
    get diagnostics old_events = row_count;

    delete from public.listing_lifecycle where removed_at < now() - interval '730 days';

    delete from public.funnel_event where created_at < now() - interval '400 days';

    return next;
end;
$$;

commit;
