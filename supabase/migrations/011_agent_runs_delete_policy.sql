-- Allow users to delete their own run history rows.
-- Required so chat-history clear actions can remove activity without service-role fallback.
create policy "Users can delete own agent runs"
  on public.agent_runs
  for delete
  using (auth.uid() = user_id);
