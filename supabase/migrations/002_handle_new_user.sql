-- public.users already exists (id, created_at, email, name). Add welcome_sent for trigger.
alter table public.users
  add column if not exists welcome_sent boolean not null default false;

-- Sync new auth users into public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, welcome_sent)
  values (new.id, new.email, false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
