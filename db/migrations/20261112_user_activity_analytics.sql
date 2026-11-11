create table if not exists public.user_activity_daily (
    user_id bigint not null references public.app_user(id) on delete cascade,
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
    on public.user_activity_daily (day desc, user_id);
alter table public.user_activity_daily enable row level security;
revoke all privileges on table public.user_activity_daily from anon, authenticated;
grant select, insert, update, delete on table public.user_activity_daily to carcar_runtime;
