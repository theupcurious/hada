alter table public.conversation_segments enable row level security;

drop policy if exists "Users can read own conversation segments" on public.conversation_segments;
create policy "Users can read own conversation segments"
  on public.conversation_segments
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own conversation segments" on public.conversation_segments;
create policy "Users can create own conversation segments"
  on public.conversation_segments
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own conversation segments" on public.conversation_segments;
create policy "Users can update own conversation segments"
  on public.conversation_segments
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own conversation segments" on public.conversation_segments;
create policy "Users can delete own conversation segments"
  on public.conversation_segments
  for delete
  using (auth.uid() = user_id);
