-- segment_artifacts: durable outputs tied to internal conversation segments
-- Depends on 012_conversation_segments.sql.
do $$
begin
  if to_regclass('public.conversation_segments') is null then
    raise exception
      '014_segment_artifacts.sql requires 012_conversation_segments.sql to be applied first';
  end if;
end;
$$;

create table if not exists segment_artifacts (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references conversation_segments(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  source_message_id uuid references messages(id) on delete set null,
  assistant_message_id uuid references messages(id) on delete set null,
  kind text not null default 'analysis' check (kind in ('memo', 'analysis', 'summary', 'other')),
  title text not null,
  summary text not null,
  content text not null default '',
  summary_embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_segment_artifacts_segment on segment_artifacts (segment_id, created_at desc);
create index if not exists idx_segment_artifacts_conversation on segment_artifacts (conversation_id, created_at desc);
create index if not exists idx_segment_artifacts_user on segment_artifacts (user_id, created_at desc);

create or replace function update_segment_artifacts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger segment_artifacts_updated_at
  before update on segment_artifacts
  for each row execute procedure update_segment_artifacts_updated_at();

alter table segment_artifacts enable row level security;

create policy "Users can read own segment artifacts"
  on segment_artifacts for select
  using (auth.uid() = user_id);

create policy "Users can create own segment artifacts"
  on segment_artifacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own segment artifacts"
  on segment_artifacts for update
  using (auth.uid() = user_id);

create policy "Users can delete own segment artifacts"
  on segment_artifacts for delete
  using (auth.uid() = user_id);
