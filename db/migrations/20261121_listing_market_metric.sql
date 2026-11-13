-- Рыночные метрики по объявлению: цена, позиция, ликвидность.
--
-- Одна текущая строка на объявление. `report` хранит критерии и аналоги,
-- чтобы цифру можно было воспроизвести. История не пишется: при изменении
-- цены/модели строка перезаписывается.
--
-- Идемпотентно.

begin;

create table if not exists public.listing_market_metric (
    listing_id      bigint primary key references public.listing(id) on delete cascade,
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
    on public.listing_market_metric (segment_key, computed_at desc);
create index if not exists listing_market_metric_computed_idx
    on public.listing_market_metric (computed_at desc);

alter table public.listing_market_metric enable row level security;
revoke all on public.listing_market_metric from anon, authenticated;
grant select, insert, update, delete on public.listing_market_metric to carcar_runtime;

commit;
