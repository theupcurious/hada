-- Agent loop + Telegram integration schema

create extension if not exists pgcrypto;

-- Allow system compaction messages
alter table public.messages
  drop constraint if exists messages_role_check;

alter table public.messages
  add constraint messages_role_check
  check (role in ('user', 'assistant', 'system'));

-- Conversation compaction marker
alter table public.conversations
  add column if not exists compacted_through timestamp with time zone;

-- User settings for provider/model preferences and future options
alter table public.users
  add column if not exists settings jsonb not null default jsonb_build_object(
    'llm_provider', 'minimax',
    'llm_model', null
  );

comment on column public.users.settings is 'User settings JSON (provider/model/timezone and future preferences).';

-- Extend integrations to support telegram and token-less providers
alter table public.integrations
  drop constraint if exists integrations_provider_check;

alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'microsoft', 'telegram'));

alter table public.integrations
  alter column refresh_token drop not null;

alter table public.integrations
  alter column expires_at drop not null;

-- Topic-keyed long-term memory
create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  content text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique(user_id, topic)
);

-- Temporary token for Telegram account linking
create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Scheduled one-time and recurring tasks
create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('once', 'recurring')),
  cron_expression text,
  run_at timestamp with time zone,
  description text not null,
  enabled boolean not null default true,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  check (
    (type = 'once' and run_at is not null and cron_expression is null) or
    (type = 'recurring' and cron_expression is not null)
  )
);

-- RLS
alter table public.user_memories enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.scheduled_tasks enable row level security;

-- user_memories policies
create policy "Users can view own memories" on public.user_memories
  for select using (auth.uid() = user_id);

create policy "Users can create own memories" on public.user_memories
  for insert with check (auth.uid() = user_id);

create policy "Users can update own memories" on public.user_memories
  for update using (auth.uid() = user_id);

create policy "Users can delete own memories" on public.user_memories
  for delete using (auth.uid() = user_id);

-- telegram_link_tokens policies
create policy "Users can view own telegram tokens" on public.telegram_link_tokens
  for select using (auth.uid() = user_id);

create policy "Users can create own telegram tokens" on public.telegram_link_tokens
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own telegram tokens" on public.telegram_link_tokens
  for delete using (auth.uid() = user_id);

-- scheduled_tasks policies
create policy "Users can view own scheduled tasks" on public.scheduled_tasks
  for select using (auth.uid() = user_id);

create policy "Users can create own scheduled tasks" on public.scheduled_tasks
  for insert with check (auth.uid() = user_id);

create policy "Users can update own scheduled tasks" on public.scheduled_tasks
  for update using (auth.uid() = user_id);

create policy "Users can delete own scheduled tasks" on public.scheduled_tasks
  for delete using (auth.uid() = user_id);

-- updated_at trigger for user_memories
drop trigger if exists update_user_memories_updated_at on public.user_memories;
create trigger update_user_memories_updated_at
  before update on public.user_memories
  for each row execute procedure public.update_updated_at();

-- Indexes
create index if not exists idx_user_memories_user_updated
  on public.user_memories(user_id, updated_at desc);

create index if not exists idx_telegram_link_tokens_token
  on public.telegram_link_tokens(token);

create index if not exists idx_telegram_link_tokens_expires_at
  on public.telegram_link_tokens(expires_at);

create index if not exists idx_scheduled_tasks_due_once
  on public.scheduled_tasks(enabled, run_at)
  where type = 'once';

create index if not exists idx_scheduled_tasks_due_recurring
  on public.scheduled_tasks(enabled, cron_expression, last_run_at)
  where type = 'recurring';
