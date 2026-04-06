# Database Schema

## Overview

Hada uses PostgreSQL via Supabase. Application data is stored in `public.*` tables, while authentication is handled by Supabase in `auth.users`. Row Level Security (RLS) is enabled on user-owned tables so users only access their own data.

Current migration chain:
- `001_initial_schema.sql`
- `002_add_user_permissions.sql`
- `004_agent_and_telegram.sql`
- `005_agent_runs.sql`
- `006_background_jobs.sql`
- `007_memory_embeddings.sql`
- `008_messages_update_policy.sql` — adds UPDATE RLS policy for messages (required for feedback/metadata updates)
- `009_default_openrouter_provider.sql` — sets OpenRouter as the default `llm_provider` in `users.settings`
- `010_documents.sql` — adds the `documents` table with RLS and indexes
- `011_agent_runs_delete_policy.sql` — allows users to delete their own run history rows

## Entity Relationship Diagram

```text
auth.users
    │ 1:1
    ▼
users ────────────────┬───────────────┬───────────────┬──────────────────┬──────────────┐
                      │               │               │                  │              │
                      ▼               ▼               ▼                  ▼              ▼
                conversations    user_memories   scheduled_tasks    integrations    documents
                      │
                      ▼
                   messages ────────────────┬─────────────────────────▶ agent_runs
                      ▲                     │
                      │                     ▼
                      └──────────── background_jobs ───────────────▶ background_job_events

users ───────────────────────────────────────────────▶ telegram_link_tokens
```

## Tables

### users

Extends `auth.users` with application-specific profile, permission, and model settings.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, references `auth.users.id` |
| email | text | User email |
| name | text | Display name, nullable |
| avatar_url | text | Avatar URL, nullable |
| tier | text | `free`, `paid`, or `pro` |
| permissions | jsonb | Tool/action permission modes |
| settings | jsonb | User runtime preferences |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last profile update |

Example `settings` payload:

```json
{
  "llm_provider": "openrouter",
  "llm_model": "minimax/minimax-m2.7",
  "timezone": "America/New_York",
  "persona": "concise",
  "custom_instructions": "Always respond in Korean when I write in Korean."
}
```

Notes:
- `llm_provider` / `llm_model` are runtime preferences; model override behavior is gated by application logic, not by the schema itself.
- `timezone` is used to personalize scheduling and time-aware responses.
- `persona` selects a pre-built communication style (`balanced`, `concise`, `friendly`, `professional`, `academic`). Omitting it or setting it to `balanced` uses the default prompt with no modifier.
- `custom_instructions` is injected verbatim into the system prompt as a `## Custom Instructions` section; `null` or omitted means no custom instructions are applied.

Example `permissions` payload:

```json
{
  "google_calendar_read": "direct",
  "google_calendar_write": "confirm"
}
```

### conversations

Unified chat threads. Each user currently uses one active conversation across web, Telegram, and scheduled runs.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| title | text | Optional title |
| compacted_through | timestamptz | Messages before this point have been compacted |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time |

### messages

Persisted user/assistant/system messages within a conversation.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| conversation_id | uuid | Parent conversation |
| role | text | `user`, `assistant`, or `system` |
| content | text | Message body |
| metadata | jsonb | Message metadata |
| created_at | timestamptz | Creation time |

Common `metadata` fields:

```json
{
  "source": "web",
  "runId": "uuid",
  "backgroundJob": {
    "id": "uuid",
    "status": "queued",
    "pending": true
  },
  "cards": [
    {
      "type": "search_results",
      "data": {
        "query": "latest AI agents news",
        "results": []
      }
    }
  ],
  "confirmation": {
    "pending": true
  },
  "gatewayError": {
    "code": "AGENT_ERROR",
    "message": "..."
  },
  "type": "compaction"
}
```

Notes:
- assistant messages may persist `gatewayError` when the run completes with a surfaced agent/runtime failure
- assistant messages for queued long-form jobs persist `backgroundJob` state so the chat UI can resume polling after reload
- assistant messages may persist rich card payloads in `metadata.cards`; these currently back inline search, schedule, table, and smart-card renderers in the chat UI
- plan/delegation progress is streamed live to the UI but not stored as first-class relational rows
- high-level thinking status is streamed as live events; raw chain-of-thought text is not persisted as canonical assistant content
- Gemini `thought_signature` values used for tool-call replay are runtime transport fields and are not stored in relational columns

Current card payload families stored in `metadata.cards`:
- `search_results`
- `schedule_view`
- `data_table`
- `link_preview`
- `comparison`
- `steps`
- `checklist`

### integrations

OAuth/channel credentials for external providers.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| provider | text | `google`, `microsoft`, or `telegram` |
| access_token | text | Provider credential |
| refresh_token | text | Refresh token, nullable |
| expires_at | timestamptz | Expiration time, nullable |
| scopes | text[] | Granted scopes |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last refresh/update |

### user_memories

Long-term memory entries keyed by topic, with optional semantic embeddings.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| topic | text | Stable memory key |
| content | text | Stored memory content |
| embedding | vector(1536) | Optional pgvector embedding for semantic recall |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time |

Constraint:
- unique index on `(user_id, topic)`

Usage notes:
- this is the single durable memory store used by the agent loop, the Settings memory tab, and the Dashboard memory manager
- chat history deletion does not delete `user_memories`
- application-level validation keeps this table focused on durable user facts/preferences rather than long research summaries
- current application-level save/extraction paths cap `topic` at 60 chars and `content` at 500 chars
- rows can be written explicitly by `save_memory`, automatically before conversation compaction, or automatically after a completed turn
- semantic recall uses `embedding` when present; keyword fallback does not depend on embeddings

Indexes:
- btree index on `(user_id, updated_at desc)` from `004_agent_and_telegram.sql`
- ivfflat cosine index on `embedding` from `007_memory_embeddings.sql`

### scheduled_tasks

Assistant-created once or recurring tasks.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| type | text | `once` or `recurring` |
| cron_expression | text | Cron string for recurring tasks, nullable |
| run_at | timestamptz | One-time execution timestamp, nullable |
| description | text | Task description |
| enabled | boolean | Whether the task is active |
| last_run_at | timestamptz | Last execution timestamp, nullable |
| created_at | timestamptz | Creation time |

### documents

User-managed documents for the `/docs` workspace. Documents act as RAG context when referenced in chat and as co-authored artifacts via Hada Canvas.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| title | text | Document title |
| content | text | Markdown content, defaults to empty string |
| folder | text | Optional single-level folder name, null = root |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time (auto-maintained by trigger) |

Usage notes:
- `folder` supports one level of nesting only (e.g., `"Work"`, not `"Work/Projects"`)
- RLS grants full CRUD to the owning user; no service-role bypass is needed for document writes
- Agent tools `list_documents`, `read_document`, `create_document`, and `update_document` all operate on this table

Indexes:
- `documents_user_id_idx` on `(user_id)`
- `documents_user_folder_idx` on `(user_id, folder)`

### telegram_link_tokens

Short-lived tokens used to link Telegram accounts.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| token | text | Link token |
| expires_at | timestamptz | Expiration timestamp |
| used_at | timestamptz | Consumption timestamp, nullable |
| created_at | timestamptz | Creation time |

### agent_runs

Run-level telemetry for each agent execution. This powers the dashboard activity feed and analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| conversation_id | uuid | Related conversation, nullable |
| source | text | `web`, `telegram`, or `scheduled` |
| status | text | `running`, `completed`, `failed`, or `timeout` |
| started_at | timestamptz | Run start time |
| finished_at | timestamptz | Run end time, nullable while running |
| duration_ms | integer | Wall-clock duration |
| input_preview | text | First ~200 chars of input |
| output_preview | text | First ~200 chars of output |
| tool_calls | jsonb | Array of `{ name, callId, durationMs, status }` |
| error | text | Final error text, nullable |
| metadata | jsonb | Extra metadata such as `runId` |
| created_at | timestamptz | Row creation time |

Notes:
- `status = 'timeout'` is used when the run exceeds configured runtime/idle budgets
- `tool_calls` is a compact per-run summary, not a full event log
- full streaming trace state remains ephemeral in the live chat UI

### background_jobs

Queue rows for long-form requests that should not complete inside the original `/api/chat` request.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| conversation_id | uuid | Related conversation |
| user_message_id | uuid | Existing user message row |
| assistant_message_id | uuid | Placeholder/final assistant message row |
| source | text | `web`, `telegram`, or `scheduled` |
| request_text | text | Original request text |
| status | text | `queued`, `running`, `completed`, `failed`, or `timeout` |
| processing_token | text | Optional claim token for post-response kickoff |
| attempts | integer | Processing attempt count |
| started_at | timestamptz | Processing start time, nullable |
| finished_at | timestamptz | Processing end time, nullable |
| last_error | text | Final error text, nullable |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time |

Usage notes:
- created by `/api/chat` when `isLongJobMessage()` classifies a request as long-form
- linked directly to the existing conversation/message rows so the final response appears in the same chat thread
- picked up either by the immediate `/api/background-jobs/[id]/run` trigger or by `/api/cron`

### background_job_events

Persisted event stream for queued background jobs.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| job_id | uuid | Parent background job |
| user_id | uuid | Owner |
| seq | integer | Monotonic per-job event sequence |
| event | jsonb | Serialized `AgentEvent` payload |
| created_at | timestamptz | Creation time |

Usage notes:
- stores the pollable event stream for long-form jobs
- powers `/api/background-jobs/[id]` so the chat UI can replay tool/progress updates after the original request finishes
- complements `agent_runs`; it does not replace run-level telemetry

## Database Functions

### match_user_memories(query_embedding, match_user_id, match_threshold, match_count)

Semantic search helper introduced in `007_memory_embeddings.sql`.

Arguments:
- `query_embedding vector(1536)`: embedding generated from the recall query text
- `match_user_id uuid`: restricts search to a single user
- `match_threshold float`: minimum cosine similarity threshold, default `0.3`
- `match_count int`: max rows returned, default `20`

Returns:
- `id uuid`
- `topic text`
- `content text`
- `updated_at timestamptz`
- `similarity float`

Usage notes:
- the application calls this function from `recall_memory` before falling back to `ILIKE` search
- rows with `embedding IS NULL` are skipped automatically
- if pgvector search returns no matches or embedding generation is unavailable, the application falls back to text search across `topic` and `content`

## RLS Model

User-owned tables enforce `auth.uid() = user_id` semantics:
- `users`
- `conversations`
- `messages` via conversation ownership
- `integrations`
- `user_memories`
- `scheduled_tasks`
- `documents`
- `telegram_link_tokens`
- `agent_runs`
- `background_jobs`
- `background_job_events`

Webhook/cron flows use the service-role client where necessary.

## Indexes

Important indexes currently documented by schema/migrations:

```sql
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE UNIQUE INDEX idx_user_memories_user_topic ON user_memories(user_id, topic);
CREATE INDEX idx_user_memories_user_updated ON user_memories(user_id, updated_at DESC);
CREATE INDEX idx_user_memories_embedding ON user_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_scheduled_tasks_user_id ON scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_run_at ON scheduled_tasks(run_at) WHERE enabled = true;
CREATE UNIQUE INDEX idx_telegram_link_tokens_token ON telegram_link_tokens(token);
CREATE INDEX idx_agent_runs_user ON agent_runs(user_id, started_at DESC);
CREATE INDEX idx_agent_runs_status ON agent_runs(user_id, status) WHERE status = 'running';
CREATE INDEX idx_background_jobs_user_created ON background_jobs(user_id, created_at DESC);
CREATE INDEX idx_background_jobs_queue ON background_jobs(status, created_at ASC) WHERE status in ('queued', 'running');
CREATE INDEX idx_background_job_events_job_seq ON background_job_events(job_id, seq ASC);
CREATE INDEX documents_user_id_idx ON documents(user_id);
CREATE INDEX documents_user_folder_idx ON documents(user_id, folder);
```

## Notes

- Planning state and delegation trace state are still ephemeral runtime constructs; they are not stored as first-class relational tables.
- Long-form background-job progress is persisted, but only as a replay/event log in `background_job_events`, not as normalized tool/plan tables.
- Settings memory and Dashboard memory are both CRUD surfaces over `user_memories`; there is not a second agent-only memory table.
- The TypeScript source of truth for runtime/database shapes is [src/lib/types/database.ts](/Users/james/Projects/Coding/hada/src/lib/types/database.ts).
