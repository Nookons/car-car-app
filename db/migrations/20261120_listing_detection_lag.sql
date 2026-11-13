-- Задержка подтверждения снятия: removed_at − last_seen_at.
--
-- Если объявление последний раз видели за 8 дней до подтверждения (старая
-- запись, всплывшая при полном обходе), dom_days — только нижняя оценка.
-- Такие строки помечаем outcome='unknown' / 'stale_detection' и не пускаем
-- в «срок продажи».
--
-- Идемпотентно.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '5s';

alter table public.listing_lifecycle
    add column if not exists detection_lag_days numeric(8, 2) not null default 0
        check (detection_lag_days >= 0);

create index if not exists listing_lifecycle_stale_idx
    on public.listing_lifecycle (detection_lag_days)
    where detection_lag_days > 0;

with lagged as (
    select listing_id,
           round(
               greatest(
                   0,
                   extract(epoch from (removed_at - last_seen_at)) / 86400
               )::numeric,
               2
           ) as lag
    from public.listing_lifecycle
)
update public.listing_lifecycle lc
set detection_lag_days = lagged.lag,
    outcome = case when lagged.lag > 1 then 'unknown' else lc.outcome end,
    outcome_reason = case
        when lagged.lag > 1 then 'stale_detection'
        else lc.outcome_reason
    end
from lagged
where lc.listing_id = lagged.listing_id;

commit;
