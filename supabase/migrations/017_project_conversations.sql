-- Per-project conversations ("Spaces").
--
-- Until now every user had a single conversation and all channels shared it,
-- so distinct topics (markets, health, …) piled into one messy thread. This
-- gives each project its own conversation; the pre-existing conversation keeps
-- project_id = NULL and becomes the default "General" space. Telegram/cron keep
-- landing on General because they pass no project.
--
-- Segments, documents, artifacts already scope to a project via
-- conversation_segments.metadata->>'project_id' and the docs folder; this simply
-- adds the missing scope on the messages/conversation thread itself.

alter table conversations
  add column if not exists project_id uuid references projects(id) on delete cascade;

-- Exactly one conversation per (user, project). NULL project_id collapses to a
-- fixed sentinel so the "General" space is also unique per user (a plain unique
-- index would treat every NULL as distinct and allow duplicates).
--
-- NOTE: if a user somehow already has more than one conversation row, this index
-- will fail to create. Inspect with:
--   select user_id, count(*) from conversations group by 1 having count(*) > 1;
-- and consolidate before applying.
create unique index if not exists idx_conversations_user_project
  on conversations (user_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Helps resolve "this project's conversation" quickly.
create index if not exists idx_conversations_project
  on conversations (project_id)
  where project_id is not null;
