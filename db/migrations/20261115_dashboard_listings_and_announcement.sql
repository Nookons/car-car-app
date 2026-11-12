begin;

create table if not exists public.app_announcement (
    id smallint primary key check (id = 1),
    message text not null check (length(btrim(message)) between 1 and 500),
    starts_at timestamptz not null,
    ends_at timestamptz not null check (ends_at > starts_at),
    updated_at timestamptz not null default now()
);

create index if not exists listing_status_last_seen_idx
    on public.listing (status, last_seen_at desc, id desc);
create index if not exists listing_source_status_last_seen_idx
    on public.listing (source_id, status, last_seen_at desc, id desc);

alter table public.app_announcement enable row level security;
revoke all on public.app_announcement from anon, authenticated;
grant select, insert, update, delete on public.app_announcement to carcar_runtime;

commit;
