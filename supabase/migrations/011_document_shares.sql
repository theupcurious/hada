create table if not exists document_shares (
  document_id uuid primary key references documents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  share_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists document_shares_share_id_idx on document_shares(share_id);
create index if not exists document_shares_user_id_idx on document_shares(user_id);

alter table document_shares enable row level security;

create policy "Users can read own document shares"
  on document_shares for select
  using (auth.uid() = user_id);

create policy "Users can create own document shares"
  on document_shares for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from documents
      where documents.id = document_shares.document_id
        and documents.user_id = auth.uid()
    )
  );

create policy "Users can delete own document shares"
  on document_shares for delete
  using (auth.uid() = user_id);
