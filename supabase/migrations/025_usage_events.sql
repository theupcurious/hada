-- Usage metering and plan quotas.
--
-- 1. usage_events: one row per metered call that spends platform money (LLM
--    completions, embeddings, web searches) plus one `run` row per assistant
--    run, which is what the monthly message quota counts. Users can read their
--    own rows but never write or delete them (unlike agent_runs, which users can
--    delete, so it can't be the quota counter).
-- 2. get_usage_summary: one-query monthly totals for quota checks.
-- 3. A guard so users can't change their own `tier` through the public API.
--
-- user_id is nullable on purpose: a call made outside a user context is still
-- recorded (and logged) so gaps in attribution are visible rather than silent.

create table if not exists public.usage_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  kind text not null check (kind in ('run', 'llm', 'embedding', 'web_search')),
  -- What the call was for: chat, compaction, segment_summary, memory_extraction,
  -- follow_up, embedding, web_search, ...
  purpose text not null default 'chat',
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  -- Provider-reported cost when available (OpenRouter); null otherwise.
  cost_usd numeric(12, 6),
  -- true when tokens were estimated (e.g. stream aborted before the usage chunk).
  estimated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user_created
  on public.usage_events(user_id, created_at desc);

create index if not exists idx_usage_events_agent_run
  on public.usage_events(agent_run_id)
  where agent_run_id is not null;

alter table public.usage_events enable row level security;

-- Users can read their own usage; writes go through the service role only.
drop policy if exists "Users can view own usage" on public.usage_events;
create policy "Users can view own usage"
  on public.usage_events for select
  using (auth.uid() = user_id);

-- Monthly totals for quota checks. Service role only: callers pass the user id.
create or replace function public.get_usage_summary(p_user_id uuid, p_since timestamptz)
returns table (
  runs bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric
)
language sql
stable
set search_path = public
as $$
  select
    count(*) filter (where kind = 'run') as runs,
    coalesce(sum(input_tokens), 0)::bigint as input_tokens,
    coalesce(sum(output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(cost_usd), 0) as cost_usd
  from public.usage_events
  where user_id = p_user_id
    and created_at >= p_since;
$$;

revoke all on function public.get_usage_summary(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_usage_summary(uuid, timestamptz) to service_role;

-- The "Users can update own profile" policy (001) covers every column, so
-- without this a signed-in user could PATCH their own row to tier = 'pro'
-- with the public anon key. Only the service role (billing webhooks, admin
-- tooling) and direct SQL may change a tier.
create or replace function public.guard_user_tier_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tier is distinct from old.tier
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'tier can only be changed by the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_tier_change on public.users;
create trigger guard_user_tier_change
  before update on public.users
  for each row execute function public.guard_user_tier_change();
