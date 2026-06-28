-- projects: user-visible containers that bundle a docs folder, chat segments,
-- and artifacts under one named workspace.
-- Segments are tagged to a project via conversation_segments.metadata->>'project_id'
-- (no schema change required on that table). Documents are bound by matching folder.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  folder text not null,
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user on projects (user_id, created_at desc);
create unique index if not exists idx_projects_user_folder on projects (user_id, folder);

create or replace function update_projects_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on projects
  for each row execute procedure update_projects_updated_at();

alter table projects enable row level security;

create policy "Users can read own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can create own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);

-- Helps the project detail view query "segments in this project" efficiently.
create index if not exists idx_conversation_segments_project
  on conversation_segments ((metadata->>'project_id'));
