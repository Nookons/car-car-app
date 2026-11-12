-- План 2027, первые 14 дней: воронка и шортлист.
--
-- funnel_event — обезличенные события (тип + случайный visitor_id, без IP и
-- поисковых фраз). favorite.status/note — шортлист со статусами и заметкой.
-- Идемпотентно.

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

alter table funnel_event enable row level security;
revoke all privileges on table public.funnel_event from anon, authenticated;

-- Храним события 400 дней; функция уже есть в схеме, здесь обновляем её тело.
create or replace function carcar_purge(retention_days integer default 30)
returns table (removed_listings bigint, old_runs bigint, old_rejects bigint, old_events bigint)
language plpgsql
as $$
begin
    delete from listing
    where status = 'removed' and last_seen_at < now() - make_interval(days => retention_days);
    get diagnostics removed_listings = row_count;

    delete from crawl_run where started_at < now() - interval '90 days';
    get diagnostics old_runs = row_count;

    delete from ingest_reject where created_at < now() - interval '30 days';
    get diagnostics old_rejects = row_count;

    delete from listing_event where observed_at < now() - interval '180 days';
    get diagnostics old_events = row_count;

    delete from funnel_event where created_at < now() - interval '400 days';

    return next;
end;
$$;
