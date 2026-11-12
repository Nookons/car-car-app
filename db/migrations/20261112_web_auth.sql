-- Веб-версия CarCar: вход по e-mail и телефону рядом с Telegram Mini App.
--
-- Telegram-путь не меняется: `app_user.tg_id` остаётся, просто теперь может
-- быть NULL. Пароль — только scrypt-хеш, сессия — SHA-256 от случайного
-- токена в httpOnly-cookie. Подтверждение почты и телефона — одноразовые
-- записи в `auth_token` с TTL и счётчиком попыток.
--
-- Миграция идемпотентна: её можно применять повторно.

alter table app_user alter column tg_id drop not null;

alter table app_user add column if not exists email text;
alter table app_user add column if not exists email_verified_at timestamptz;
alter table app_user add column if not exists phone text;
alter table app_user add column if not exists phone_verified_at timestamptz;
alter table app_user add column if not exists password_hash text;

-- Почта сравнивается без регистра, поэтому уникален lower(email).
create unique index if not exists app_user_email_key
    on app_user (lower(email)) where email is not null;
create unique index if not exists app_user_phone_key
    on app_user (phone) where phone is not null;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'app_user_identity_check'
    ) then
        alter table app_user add constraint app_user_identity_check
            check (tg_id is not null or email is not null or phone is not null);
    end if;
end $$;

-- Одна строка — одна активная cookie-сессия. В базе только хеш токена:
-- утечка дампа не даёт войти. CSRF-токен привязан к сессии тем же хешем.
create table if not exists web_session (
    id           bigint generated always as identity primary key,
    user_id      bigint not null references app_user(id) on delete cascade,
    token_hash   text not null unique,
    csrf_hash    text not null,
    user_agent   text,
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    expires_at   timestamptz not null,
    revoked_at   timestamptz
);

create index if not exists web_session_user_idx
    on web_session (user_id) where revoked_at is null;
create index if not exists web_session_expires_idx on web_session (expires_at);

-- Одноразовые ссылки и SMS-коды. token_hash — для писем, code_hash — для
-- телефона; у кода дополнительно хранится число неудачных попыток.
create table if not exists auth_token (
    id           bigint generated always as identity primary key,
    user_id      bigint not null references app_user(id) on delete cascade,
    kind         text not null check (kind in
                    ('email_verify', 'password_reset', 'phone_verify', 'phone_login')),
    destination  text not null,
    token_hash   text,
    code_hash    text,
    attempts     integer not null default 0,
    expires_at   timestamptz not null,
    consumed_at  timestamptz,
    created_at   timestamptz not null default now()
);

create index if not exists auth_token_token_idx
    on auth_token (kind, token_hash) where token_hash is not null;
create index if not exists auth_token_destination_idx
    on auth_token (kind, destination, created_at desc);
create index if not exists auth_token_expires_idx on auth_token (expires_at);

-- Сессии и одноразовые токены — только для бэкенда, как и остальные таблицы.
alter table web_session enable row level security;
alter table auth_token  enable row level security;
revoke all privileges on table public.web_session, public.auth_token from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
