-- Slice 2: per-space identity + scoped memory.
--
-- Part 1 — per-space instructions: a free-text directive attached to a project
-- ("you are a markets analyst, be terse, always cite a source"). It layers into
-- the system prompt via buildProjectContextSection so each space behaves like a
-- distinct assistant while General stays generic.
--
-- Part 2 — scoped memory: until now every memory was global, so a Health fact
-- could surface mid-markets conversation. Each memory now carries an optional
-- project_id. A NULL project_id is a *global* fact (visible in every space); a
-- set project_id is a *space* fact (visible only in that space). Recall filters
-- to `project_id IS NULL OR project_id = <active>`.
--
-- Prereq: migration 017 (conversations.project_id) must be applied first.
--
-- VERIFY AFTER APPLYING (both `if exists` drops below fail SILENTLY if their
-- name/signature doesn't match, leaving the feature broken while reporting
-- success). Run these two and confirm the expected result:
--   -- must return ZERO rows (old unique(user_id, topic) is gone):
--   select conname from pg_constraint
--     where conrelid = 'public.user_memories'::regclass and contype = 'u';
--   -- must return exactly 1 (no leftover RPC overload → no PGRST203):
--   select count(*) from pg_proc where proname = 'match_user_memories';

-- Wrapped in a transaction so it's all-or-nothing: if any step errors (e.g. the
-- unique index), the drop constraint above it rolls back too, so the table is
-- never left without uniqueness protection. None of these use CONCURRENTLY, so
-- they're all transaction-safe.
begin;

-- Part 1 -----------------------------------------------------------------------
alter table projects
  add column if not exists instructions text;

-- Part 2 -----------------------------------------------------------------------
alter table user_memories
  add column if not exists project_id uuid references projects(id) on delete cascade;

-- The old unique(user_id, topic) would collide the same topic across spaces
-- (a Markets "diet" vs a Health "diet"), silently no-opping scoped writes.
-- Drop it and replace with a (user, space, topic) uniqueness that treats NULL
-- project_id as a fixed sentinel so global topics stay unique per user.
alter table user_memories
  drop constraint if exists user_memories_user_id_topic_key;

create unique index if not exists idx_user_memories_user_project_topic
  on user_memories (
    user_id,
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    topic
  );

create index if not exists idx_user_memories_project
  on user_memories (project_id)
  where project_id is not null;

-- Recall RPC: scope semantic matches to the active space plus globals.
-- NOTE: CREATE OR REPLACE with a new argument list creates a *second* overload
-- (PGRST203 ambiguity on call), so drop the old 4-arg signature explicitly first.
drop function if exists public.match_user_memories(vector, uuid, float, int);

create or replace function public.match_user_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_project_id uuid default null,
  match_threshold float default 0.3,
  match_count int default 20
)
returns table (
  id uuid,
  topic text,
  content text,
  updated_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    um.id,
    um.topic,
    um.content,
    um.updated_at,
    1 - (um.embedding <=> query_embedding) as similarity
  from public.user_memories um
  where um.user_id = match_user_id
    and (um.project_id is null or um.project_id = match_project_id)
    and um.embedding is not null
    and 1 - (um.embedding <=> query_embedding) > match_threshold
  order by um.embedding <=> query_embedding
  limit match_count;
$$;

commit;
