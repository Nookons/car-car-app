-- Классификация снятий: продажа-кандидат, истечение срока или unknown.
--
-- Площадка не отдаёт «продано», поэтому это эвристика:
--   * цена падала перед снятием → sold_candidate;
--   * 28+ дней и цена не менялась → expired (типичное 30-дневное размещение);
--   * остальное → unknown.
--
-- Идемпотентно. Старые legacy-строки размечаются тем же правилом.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '5s';

alter table public.listing_lifecycle
    add column if not exists outcome text not null default 'unknown'
        check (outcome in ('sold_candidate', 'expired', 'unknown'));
alter table public.listing_lifecycle
    add column if not exists outcome_reason text;

create index if not exists listing_lifecycle_outcome_idx
    on public.listing_lifecycle (outcome, removed_at desc);

update public.listing_lifecycle
set outcome = case
        when dom_days >= 28 and abs(coalesce(price_change_pct, 0)) < 1 then 'expired'
        else 'unknown'
    end,
    outcome_reason = 'legacy_backfill'
where outcome = 'unknown';

commit;
