-- Track which users have set a password (so login can show password field on any device).
-- Row is created when user sets password in account settings.
create table if not exists public.user_password_set (
  email text primary key,
  set_at timestamptz not null default now()
);

alter table public.user_password_set enable row level security;

-- Authenticated user may insert/update only their own email (when they set a password in account).
create policy "User can set own password flag"
  on public.user_password_set for all
  using (lower(trim(email)) = lower(trim((auth.jwt()->>'email')::text)))
  with check (lower(trim(email)) = lower(trim((auth.jwt()->>'email')::text)));

comment on table public.user_password_set is 'Records that a user has set a password (used by login page to show password option).';
