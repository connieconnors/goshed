-- Allow authenticated users to update their own public.users row (e.g. welcome_sent) without service role.
drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
