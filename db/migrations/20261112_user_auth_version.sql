-- Per-user revocation version for stateless Mini App JWTs.
-- Existing tokens use version 0 and remain valid until explicitly revoked.
alter table public.app_user
    add column if not exists auth_version integer not null default 0;
