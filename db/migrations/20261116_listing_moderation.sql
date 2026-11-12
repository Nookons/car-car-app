begin;

-- Keep administrative decisions independent of the source's availability.
create table if not exists public.listing_moderation (
    source_id smallint not null references public.source(id),
    external_id text not null,
    action text not null check (action in ('hidden', 'deleted')),
    updated_at timestamptz not null default now(),
    primary key (source_id, external_id)
);
alter table public.listing_moderation enable row level security;
revoke all on public.listing_moderation from anon, authenticated;
grant select, insert, update, delete on public.listing_moderation to carcar_runtime;

create or replace function public.apply_listing_moderation() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare decision text;
begin
    select action into decision from public.listing_moderation
    where source_id = new.source_id and external_id = new.external_id;
    if decision = 'deleted' and tg_op = 'INSERT' then
        return null;
    end if;
    if decision in ('hidden', 'deleted') then
        new.status := 'removed';
    end if;
    return new;
end;
$$;
drop trigger if exists enforce_listing_moderation on public.listing;
create trigger enforce_listing_moderation before insert or update on public.listing
for each row execute function public.apply_listing_moderation();

commit;
