# Database Schema

## Overview

Hada uses Supabase Postgres (`public` schema) plus Supabase Auth (`auth.users`).

- App data is stored in `public.*` tables.
- Most app tables are protected with RLS.
- User ownership is typically enforced with `auth.uid() = user_id` (or conversation ownership for messages).

Current migration chain:

1. `001_initial_schema.sql`
2. `002_add_user_permissions.sql`
3. `004_agent_and_telegram.sql`
4. `005_agent_runs.sql`
5. `006_background_jobs.sql`
6. `007_memory_embeddings.sql`
7. `008_messages_update_policy.sql`
8. `009_default_openrouter_provider.sql`
9. `010_documents.sql`
10. `011_agent_runs_delete_policy.sql`

## High-Level Relationships

```text
auth.users
   │ 1:1
   ▼
users ────────────────┬───────────────┬───────────────┬───────────────┬──────────────┬─────────────┐
                      │               │               │               │              │             │
                      ▼               ▼               ▼               ▼              ▼             ▼
                conversations    user_memories   scheduled_tasks  integrations   documents  telegram_link_tokens
                      │
                      ▼
                   messages ────────────────────────▶ agent_runs
                      │
                      └─────────────────────────────▶ background_jobs ─────────────▶ background_job_events
```

## Tables

### `users`

Extends `auth.users` with profile + runtime config.

Key columns:

- `id uuid primary key references auth.users(id)`
- `email text not null`
- `name text`
- `avatar_url text`
- `tier text check (free|paid|pro)`
- `permissions jsonb`
- `settings jsonb`
- `created_at`, `updated_at`

`settings` currently stores runtime preferences such as:

- `llm_provider`, `llm_model`, `llm_fallback_model`
- `locale`, `timezone`
- `persona`, `custom_instructions`
- `onboarding_completed`
- `working_style` / `assistant_preferences` / `welcome_state`

`permissions` stores action modes (`direct`/`confirm`) for integration-sensitive actions.

### `conversations`

Conversation thread container.

- `id`
- `user_id`
- `title`
- `compacted_through` (timestamp marker for conversation compaction)
- `created_at`, `updated_at`

### `messages`

Conversation messages.

- `id`
- `conversation_id`
- `role` (`user`, `assistant`, `system`)
- `content`
- `metadata jsonb`
- `created_at`

Common `metadata` fields used in runtime/UI:

- `source` (`web`, `telegram`, `scheduled`)
- `runId`
- `type: "compaction"`
- `cards`
- `backgroundJob`
- `followUpSuggestions`
- `feedback`
- `gatewayError`
- `confirmation`

### `integrations`

Connected provider credentials/state.

- `id`
- `user_id`
- `provider` (`google`, `microsoft`, `telegram`)
- `access_token`
- `refresh_token` (nullable)
- `expires_at` (nullable)
- `scopes text[]`
- `created_at`, `updated_at`
- unique: `(user_id, provider)`

Notes:

- `google`: OAuth tokens/scopes
- `telegram`: linked chat ID is stored in `access_token` (no refresh/expiry)

### `user_memories`

Durable long-term memory entries.

- `id`
- `user_id`
- `topic`
- `content`
- `embedding vector(1536)` (nullable)
- `created_at`, `updated_at`
- unique: `(user_id, topic)`

### `scheduled_tasks`

Scheduled assistant runs.

- `id`
- `user_id`
- `type` (`once` | `recurring`)
- `cron_expression` (required for `recurring`)
- `run_at` (required for `once`)
- `description`
- `enabled`
- `last_run_at`
- `created_at`

### `documents`

User docs for `/docs` workspace and chat context attachment.

- `id`
- `user_id`
- `title`
- `content` (default `''`)
- `folder` (nullable)
- `created_at`, `updated_at`

### `telegram_link_tokens`

Short-lived tokens for Telegram account linking.

- `id`
- `user_id`
- `token` (unique)
- `expires_at`
- `used_at`
- `created_at`

### `agent_runs`

Per-run telemetry used by dashboard/activity.

- `id`
- `user_id`
- `conversation_id` (nullable)
- `source` (`web`, `telegram`, `scheduled`)
- `status` (`running`, `completed`, `failed`, `timeout`)
- `started_at`, `finished_at`
- `duration_ms`
- `input_preview`, `output_preview`
- `tool_calls jsonb`
- `error`
- `metadata`
- `created_at`

### `background_jobs`

Queue records for long-form requests.

- `id`
- `user_id`
- `conversation_id`
- `user_message_id`
- `assistant_message_id`
- `source`
- `request_text`
- `status` (`queued`, `running`, `completed`, `failed`, `timeout`)
- `processing_token`
- `attempts`
- `started_at`, `finished_at`
- `last_error`
- `created_at`, `updated_at`

### `background_job_events`

Replayable event log for queued runs.

- `id`
- `job_id`
- `user_id`
- `seq` (unique per `job_id`)
- `event jsonb`
- `created_at`

## Database Functions

### `match_user_memories(...)`

Added in `007_memory_embeddings.sql`.

Arguments:

- `query_embedding vector(1536)`
- `match_user_id uuid`
- `match_threshold float default 0.3`
- `match_count int default 20`

Returns nearest matches from `user_memories` with cosine similarity.

Used by the `recall_memory` tool before text fallback.

## RLS Coverage

RLS is enabled on:

- `users`
- `conversations`
- `messages`
- `integrations`
- `user_memories`
- `telegram_link_tokens`
- `scheduled_tasks`
- `agent_runs`
- `background_jobs`
- `background_job_events`
- `documents`

Service-role server paths (cron/webhooks/background processing) bypass user RLS where appropriate.

## Indexes (from migrations)

```sql
create index idx_conversations_user_id on public.conversations(user_id);
create index idx_messages_conversation_id on public.messages(conversation_id);
create index idx_messages_created_at on public.messages(created_at);
create index idx_integrations_user_id on public.integrations(user_id);

create index idx_user_memories_user_updated on public.user_memories(user_id, updated_at desc);
create index idx_user_memories_embedding
  on public.user_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index idx_telegram_link_tokens_token on public.telegram_link_tokens(token);
create index idx_telegram_link_tokens_expires_at on public.telegram_link_tokens(expires_at);

create index idx_scheduled_tasks_due_once
  on public.scheduled_tasks(enabled, run_at) where type = 'once';
create index idx_scheduled_tasks_due_recurring
  on public.scheduled_tasks(enabled, cron_expression, last_run_at) where type = 'recurring';

create index idx_agent_runs_user on public.agent_runs(user_id, started_at desc);
create index idx_agent_runs_status on public.agent_runs(user_id, status) where status = 'running';

create index idx_background_jobs_user_created on public.background_jobs(user_id, created_at desc);
create index idx_background_jobs_queue
  on public.background_jobs(status, created_at asc) where status in ('queued', 'running');
create index idx_background_job_events_job_seq on public.background_job_events(job_id, seq asc);

create index documents_user_id_idx on documents(user_id);
create index documents_user_folder_idx on documents(user_id, folder);
```

## Notes

- Planning/delegation progression is streamed as events; there are no dedicated relational plan/delegation tables.
- Background job progress is event-log style (`background_job_events`), separate from run-level telemetry (`agent_runs`).
- The TypeScript runtime shape reference is `src/lib/types/database.ts`.
