-- Add cleared lifecycle support for shed items.
-- 1) New nullable timestamp for when an item is cleared.
-- 2) Allow status = 'cleared' in status check constraints.

alter table if exists public.items
  add column if not exists cleared_at timestamptz;

alter table if exists public.shed_items
  add column if not exists cleared_at timestamptz;

do $$
declare
  c record;
begin
  if to_regclass('public.items') is not null then
    for c in
      select conname
      from pg_constraint
      where conrelid = 'public.items'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%status%'
    loop
      execute format('alter table public.items drop constraint %I', c.conname);
    end loop;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.items'::regclass
        and conname = 'items_status_check'
    ) then
      alter table public.items
        add constraint items_status_check
        check (status in ('pending', 'done', 'cleared'));
    end if;
  end if;
end $$;

do $$
declare
  c record;
begin
  if to_regclass('public.shed_items') is not null then
    for c in
      select conname
      from pg_constraint
      where conrelid = 'public.shed_items'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%status%'
    loop
      execute format('alter table public.shed_items drop constraint %I', c.conname);
    end loop;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.shed_items'::regclass
        and conname = 'shed_items_status_check'
    ) then
      alter table public.shed_items
        add constraint shed_items_status_check
        check (status in ('pending', 'done', 'cleared'));
    end if;
  end if;
end $$;
