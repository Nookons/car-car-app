-- Admin-managed service pause/maintenance windows shown to app users.
create table if not exists public.service_notice (
    source_id smallint primary key references public.source(id) on delete cascade,
    mode text not null check (mode in ('paused', 'maintenance')),
    reason text not null check (length(trim(reason)) between 1 and 500),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    updated_by text not null default 'dashboard',
    updated_at timestamptz not null default now(),
    check (ends_at > starts_at)
);
alter table public.service_notice enable row level security;
revoke all privileges on table public.service_notice from anon, authenticated;
do $grant_runtime$
begin
    if exists (select 1 from pg_roles where rolname = 'carcar_runtime') then
        grant select, insert, update, delete on table public.service_notice to carcar_runtime;
    end if;
end;
$grant_runtime$;
