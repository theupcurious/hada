# Database Schema

## Overview

Hada uses PostgreSQL via Supabase. Application data is stored in `public.*` tables, while authentication is handled by Supabase in `auth.users`. Row Level Security (RLS) is enabled on user-owned tables so users only access their own data.

Current migration chain:
- `001_initial_schema.sql`
- `002_add_user_permissions.sql`
- `004_agent_and_telegram.sql`
- `005_agent_runs.sql`

## Entity Relationship Diagram

```text
auth.users
    │ 1:1
    ▼
users ────────────────┬───────────────┬───────────────┬──────────────────┐
                      │               │               │                  │
                      ▼               ▼               ▼                  ▼
                conversations    user_memories   scheduled_tasks    integrations
                      │
                      ▼
                   messages
                      │
                      └──────────────────────────────▶ agent_runs

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
  "llm_provider": "minimax",
  "llm_model": "MiniMax-M2.1",
  "timezone": "America/New_York"
}
```

Notes:
- `llm_provider` / `llm_model` are runtime preferences; model override behavior is gated by application logic, not by the schema itself.
- `timezone` is used to personalize scheduling and time-aware responses.

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
  "thinking": "...",
  "cards": [],
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
- plan/delegation progress is streamed live to the UI but not stored as first-class relational rows

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

Long-term memory entries keyed by topic.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| topic | text | Stable memory key |
| content | text | Stored memory content |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time |

Constraint:
- unique index on `(user_id, topic)`

Usage notes:
- this is the single durable memory store used by the agent loop, the Settings memory tab, and the Dashboard memory manager
- chat history deletion does not delete `user_memories`
- application-level validation keeps this table focused on durable user facts/preferences rather than long research summaries

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

## RLS Model

User-owned tables enforce `auth.uid() = user_id` semantics:
- `users`
- `conversations`
- `messages` via conversation ownership
- `integrations`
- `user_memories`
- `scheduled_tasks`
- `telegram_link_tokens`
- `agent_runs`

Webhook/cron flows use the service-role client where necessary.

## Indexes

Important indexes currently documented by schema/migrations:

```sql
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE UNIQUE INDEX idx_user_memories_user_topic ON user_memories(user_id, topic);
CREATE INDEX idx_scheduled_tasks_user_id ON scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_run_at ON scheduled_tasks(run_at) WHERE enabled = true;
CREATE UNIQUE INDEX idx_telegram_link_tokens_token ON telegram_link_tokens(token);
CREATE INDEX idx_agent_runs_user ON agent_runs(user_id, started_at DESC);
CREATE INDEX idx_agent_runs_status ON agent_runs(user_id, status) WHERE status = 'running';
```

## Notes

- Planning state and delegation trace state are ephemeral runtime constructs; they are not stored as first-class database tables.
- Settings memory and Dashboard memory are both CRUD surfaces over `user_memories`; there is not a second agent-only memory table.
- The TypeScript source of truth for runtime/database shapes is [src/lib/types/database.ts](/Users/james/Projects/Coding/hada/src/lib/types/database.ts).
