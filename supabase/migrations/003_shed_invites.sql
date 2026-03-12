-- Family sharing: invite someone to view your shed via magic link
create table if not exists public.shed_invites (
  id uuid default gen_random_uuid() primary key,
  owner_user_id uuid references auth.users(id) on delete cascade,
  owner_email text,
  invitee_email text not null,
  token uuid default gen_random_uuid() unique not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz default now()
);

alter table public.shed_invites enable row level security;

create policy "Owners can manage their invites"
  on public.shed_invites for all
  using (auth.uid() = owner_user_id);
