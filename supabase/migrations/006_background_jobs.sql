create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_message_id uuid not null references public.messages(id) on delete cascade,
  assistant_message_id uuid not null references public.messages(id) on delete cascade,
  source text not null check (source in ('web', 'telegram', 'scheduled')),
  request_text text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'timeout')),
  processing_token text,
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.background_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  seq integer not null,
  event jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique(job_id, seq)
);

alter table public.background_jobs enable row level security;
alter table public.background_job_events enable row level security;

create policy "Users can view own background jobs" on public.background_jobs
  for select using (auth.uid() = user_id);

create policy "Users can create own background jobs" on public.background_jobs
  for insert with check (auth.uid() = user_id);

create policy "Users can view own background job events" on public.background_job_events
  for select using (auth.uid() = user_id);

drop trigger if exists update_background_jobs_updated_at on public.background_jobs;
create trigger update_background_jobs_updated_at
  before update on public.background_jobs
  for each row execute procedure public.update_updated_at();

create index if not exists idx_background_jobs_user_created
  on public.background_jobs(user_id, created_at desc);

create index if not exists idx_background_jobs_queue
  on public.background_jobs(status, created_at asc)
  where status in ('queued', 'running');

create index if not exists idx_background_job_events_job_seq
  on public.background_job_events(job_id, seq asc);
