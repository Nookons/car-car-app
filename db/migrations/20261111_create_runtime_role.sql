-- Separate runtime credentials from the Supabase database owner. The runtime
-- role can use CarCar's public tables but cannot create databases or roles.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '2s';

do $carcar$
begin
    if not exists (select 1 from pg_roles where rolname = 'carcar_runtime') then
        create role carcar_runtime nologin bypassrls;
    end if;
end
$carcar$;

alter role carcar_runtime nocreatedb nocreaterole noreplication;
grant usage on schema public to carcar_runtime;
grant select, insert, update, delete on table
    public.source,
    public.listing,
    public.model_option,
    public.listing_event,
    public.crawl_run,
    public.ingest_reject,
    public.app_user,
    public.subscription,
    public.favorite,
    public.collector,
    public.sweep_state,
    public.notification,
    public.listing_stat,
    public.listing_view,
    public.listing_reaction,
    public.listing_comment
to carcar_runtime;
grant usage, select, update on all sequences in schema public to carcar_runtime;
grant execute on all functions in schema public to carcar_runtime;

-- Preserve runtime access for tables added by migrations owned by postgres.
alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to carcar_runtime;
alter default privileges for role postgres in schema public
    grant usage, select, update on sequences to carcar_runtime;
alter default privileges for role postgres in schema public
    grant execute on functions to carcar_runtime;

commit;
