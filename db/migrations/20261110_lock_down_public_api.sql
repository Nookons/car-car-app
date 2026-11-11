-- CarCar is accessed through the FastAPI service, not directly through the
-- Supabase Data API. The Railway service connects as the table owner; client
-- roles must not have direct privileges on application tables.
-- Apply as postgres during a reviewed production migration.

begin;

-- The application is served through FastAPI; Supabase client roles need no
-- direct visibility into this schema.
revoke all privileges on schema public from public, anon, authenticated;

-- These tables contain per-user activity, notifications, or writable counters.
-- No Supabase anon/authenticated policies are needed; the backend owner bypasses
-- RLS and continues serving the existing HTTP API.
alter table public.listing_comment enable row level security;
alter table public.listing_reaction enable row level security;
alter table public.listing_stat enable row level security;
alter table public.listing_view enable row level security;
alter table public.model_option enable row level security;
alter table public.notification enable row level security;

-- Remove inherited default CRUD grants from existing public objects.
revoke all privileges on table
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
from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Prevent future objects created by the application's migration owner from
-- silently reopening the Supabase Data API.
alter default privileges for role postgres in schema public
    revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated;

commit;
