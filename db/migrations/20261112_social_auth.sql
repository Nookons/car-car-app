-- Связанные входы: один app_user — несколько identity.
--
-- Telegram Mini App остаётся на tg_id, но теперь каждый Telegram-аккаунт
-- дополнительно заведён в user_identity. Google/Facebook/GitHub приходят
-- туда же, поэтому «тот же человек» узнаётся по identity, а не по email.
--
-- Идемпотентно.

create table if not exists user_identity (
    id            bigint generated always as identity primary key,
    user_id       bigint not null references app_user(id) on delete cascade,
    provider      text not null,
    subject       text not null,
    email         text,
    created_at    timestamptz not null default now(),
    last_login_at timestamptz not null default now(),
    unique (provider, subject)
);
create index if not exists user_identity_user_idx on user_identity (user_id);
create index if not exists user_identity_email_idx
    on user_identity (lower(email)) where email is not null;

insert into user_identity (user_id, provider, subject)
select id, 'telegram', tg_id::text from app_user where tg_id is not null
on conflict (provider, subject) do nothing;

-- Новые виды одноразовых токенов: смена почты и привязка Telegram из бота.
do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'auth_token_kind_check'
    ) then
        alter table auth_token drop constraint auth_token_kind_check;
    end if;
    alter table auth_token add constraint auth_token_kind_check check (kind in
        ('email_verify', 'email_change', 'password_reset',
         'phone_verify', 'phone_login', 'telegram_link'));
end $$;

alter table user_identity enable row level security;
revoke all privileges on table public.user_identity from anon, authenticated;
