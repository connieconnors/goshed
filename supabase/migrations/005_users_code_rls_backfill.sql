-- Short beta / access code per user (nullable; set manually in Supabase for specific users).
alter table public.users
  add column if not exists code text;

comment on column public.users.code is 'Optional short code assigned to the user (e.g. beta access).';

-- Keep public.users in sync with auth.users (id + email). Replaces prior insert list if function already exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, welcome_sent)
  values (new.id, new.email, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill: any auth user missing a public.users row
insert into public.users (id, email, welcome_sent)
select au.id, au.email, false
from auth.users au
where not exists (select 1 from public.users u where u.id = au.id);

-- Let signed-in clients read their own profile row (e.g. beta code from /api/auth/session).
alter table public.users enable row level security;

drop policy if exists "Users read own profile" on public.users;
create policy "Users read own profile"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);
