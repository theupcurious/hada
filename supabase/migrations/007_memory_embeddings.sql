-- Semantic memory support for long-term recall

create extension if not exists vector;

alter table public.user_memories
  add column if not exists embedding vector(1536);

create index if not exists idx_user_memories_embedding
  on public.user_memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_user_memories(
  query_embedding vector(1536),
  match_user_id uuid,
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
    and um.embedding is not null
    and 1 - (um.embedding <=> query_embedding) > match_threshold
  order by um.embedding <=> query_embedding
  limit match_count;
$$;
