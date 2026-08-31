-- Proactivity: Space-scoped scheduled tasks.
--
-- A scheduled task can belong to a Space, so a recurring briefing or reminder
-- created inside a Space runs as *that* assistant — its instructions, scoped
-- memory, tool allowlist, and its own conversation thread — rather than as
-- General. This is what turns Spaces from a passive filing system into
-- proactive, specialized assistants ("every Monday, summarize the market open"
-- scheduled in the Investing Space runs with the Investing persona).
--
--   project_id — nullable FK to projects. NULL = General (the default, and what
--                every existing task keeps). ON DELETE SET NULL so deleting a
--                Space demotes its tasks to General rather than dropping them.
--
-- Purely additive: one nullable column. Safe to re-run. The cron worker reads
-- the column off the row and degrades to NULL (General) when it's absent, so
-- scheduling and execution keep working before this migration is applied.

begin;

alter table public.scheduled_tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_scheduled_tasks_project
  on public.scheduled_tasks(project_id);

commit;

-- VERIFY AFTER APPLYING:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'scheduled_tasks' and column_name = 'project_id';
--   -- expect one row: project_id | uuid
