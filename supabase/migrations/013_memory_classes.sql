-- Add memory classification columns to user_memories.
-- The source_segment_id FK is added by 012_conversation_segments.sql.

alter table user_memories
  add column if not exists kind text not null default 'profile'
    check (kind in ('profile', 'project', 'preference', 'archive')),
  add column if not exists pinned boolean not null default false;

-- Existing memories default to 'profile' kind which is correct
