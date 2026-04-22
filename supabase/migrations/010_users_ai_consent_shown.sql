-- Persist AI disclosure acceptance (cross-device; used to skip sheet during Upgrade → purchase).
alter table public.users
  add column if not exists ai_consent_shown boolean not null default false;

comment on column public.users.ai_consent_shown is 'User has seen and accepted the in-app AI / privacy disclosure (e.g. Got it).';
