-- conversation_segments: internal topic segments within a single conversation
create table if not exists conversation_segments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  title text,
  summary text,
  summary_embedding vector(1536),
  topic_key text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  last_active_at timestamptz not null default now(),
  message_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

-- Enforce single active segment per conversation
create unique index if not exists idx_one_active_segment
  on conversation_segments (conversation_id)
  where status = 'active';

-- Add segment_id to messages (nullable during rollout)
alter table messages
  add column if not exists segment_id uuid references conversation_segments(id) on delete set null;

-- Also add source_segment_id to user_memories (Phase 1 added kind/pinned; we add the FK)
alter table user_memories
  add column if not exists source_segment_id uuid references conversation_segments(id) on delete set null;

-- Indexes
create index if not exists idx_segments_conversation on conversation_segments (conversation_id);
create index if not exists idx_segments_user on conversation_segments (user_id);
create index if not exists idx_segments_status on conversation_segments (conversation_id, status);
create index if not exists idx_messages_segment on messages (segment_id) where segment_id is not null;
