-- Add memory classification columns to user_memories
-- source_segment_id FK will be added in migration 014 after conversation_segments table is created

alter table user_memories
  add column if not exists kind text not null default 'profile'
    check (kind in ('profile', 'project', 'preference', 'archive')),
  add column if not exists pinned boolean not null default false;

-- Existing memories default to 'profile' kind which is correct
