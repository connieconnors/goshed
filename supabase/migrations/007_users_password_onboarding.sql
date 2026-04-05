-- Persist password onboarding state on public.users (cross-device; replaces relying only on welcome_sent / localStorage).
alter table public.users
  add column if not exists has_password_set boolean not null default false;

alter table public.users
  add column if not exists skipped_password_at timestamptz null;

comment on column public.users.has_password_set is 'True once the user has set a Supabase password (login + onboarding).';
comment on column public.users.skipped_password_at is 'When the user chose Skip on password onboarding; suppress prompt for 30 days.';

create index if not exists users_email_lower_idx on public.users (lower(trim(email)));

-- Backfill: anyone already recorded in user_password_set
update public.users u
set has_password_set = true
from public.user_password_set ups
where lower(trim(u.email)) = lower(trim(ups.email))
  and u.has_password_set is not true;
