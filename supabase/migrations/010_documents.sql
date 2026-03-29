-- Documents table for user-managed RAG context
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null default '',
  folder text,                          -- null = root; max one level e.g. 'Work'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast user lookups
create index if not exists documents_user_id_idx on documents(user_id);
create index if not exists documents_user_folder_idx on documents(user_id, folder);

-- Auto-update updated_at
create or replace function update_documents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_updated_at
  before update on documents
  for each row execute procedure update_documents_updated_at();

-- RLS
alter table documents enable row level security;

create policy "Users can read own documents"
  on documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on documents for delete
  using (auth.uid() = user_id);
