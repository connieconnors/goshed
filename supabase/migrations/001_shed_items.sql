-- Shed items: saved after analysis + recommendation (one per item per user)
create table if not exists public.shed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thumbnail_url text,
  item_label text not null,
  recommendation text not null check (recommendation in ('sell','donate','gift','curb','keep','repurpose')),
  value_range_raw text not null,
  value_low int not null default 0,
  value_high int not null default 0,
  status text not null default 'pending' check (status in ('pending','done')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists shed_items_user_id on public.shed_items(user_id);
create index if not exists shed_items_recommendation on public.shed_items(recommendation);
create index if not exists shed_items_status on public.shed_items(status);

alter table public.shed_items enable row level security;

create policy "Users can read own shed_items"
  on public.shed_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own shed_items"
  on public.shed_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own shed_items"
  on public.shed_items for update
  using (auth.uid() = user_id);
