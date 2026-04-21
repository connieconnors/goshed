-- Optional nudge / notification preference from password onboarding (client writes via API).
alter table public.users
  add column if not exists notification_consent boolean not null default false;

comment on column public.users.notification_consent is 'User opted in to check-ins / nudges during onboarding (default false; UI may default checkbox on).';
