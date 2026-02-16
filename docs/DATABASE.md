# Database Schema

## Overview

Hada uses PostgreSQL via Supabase. All tables have Row Level Security (RLS) enabled, ensuring users can only access their own data.

## Entity Relationship Diagram

```
┌──────────────────┐
│   auth.users     │  (Supabase managed)
│──────────────────│
│ id               │
│ email            │
│ created_at       │
└────────┬─────────┘
         │
         │ 1:1 (auto-created via trigger)
         ▼
┌──────────────────┐       ┌──────────────────┐
│     users        │       │   integrations   │
│──────────────────│       │──────────────────│
│ id (FK)          │◄──────│ user_id (FK)     │
│ email            │  1:N  │ provider         │
│ name             │       │ access_token     │
│ avatar_url       │       │ refresh_token    │
│ tier             │       │ expires_at       │
│ settings (jsonb) │       │ scopes           │
│ created_at       │       └──────────────────┘
│ updated_at       │
└────────┬─────────┘
         │
         ├──── 1:N ──────────────────────────────┐
         │                                        │
         ▼                                        ▼
┌──────────────────┐       ┌──────────────────┐  ┌──────────────────────┐
│  conversations   │       │  user_memories   │  │  scheduled_tasks     │
│──────────────────│       │──────────────────│  │──────────────────────│
│ id               │       │ id               │  │ id                   │
│ user_id (FK)     │       │ user_id (FK)     │  │ user_id (FK)         │
│ title            │       │ topic            │  │ type                 │
│ compacted_through│       │ content          │  │ cron_expression      │
│ created_at       │       │ created_at       │  │ run_at               │
│ updated_at       │       │ updated_at       │  │ description          │
└────────┬─────────┘       └──────────────────┘  │ enabled              │
         │                                        │ last_run_at          │
         │ 1:N                                    └──────────────────────┘
         ▼
┌──────────────────┐       ┌──────────────────────┐
│    messages      │       │ telegram_link_tokens │
│──────────────────│       │──────────────────────│
│ id               │       │ id                   │
│ conversation_id  │       │ user_id (FK)         │
│ role             │       │ token                │
│ content          │       │ expires_at           │
│ metadata         │       │ created_at           │
│ created_at       │       └──────────────────────┘
└──────────────────┘
```

## Tables

### users

Extends Supabase auth.users with application-specific data.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, references auth.users |
| email | text | User's email address |
| name | text | Display name (nullable) |
| avatar_url | text | Profile picture URL (nullable) |
| tier | text | Subscription tier: 'free', 'paid', 'pro' |
| settings | jsonb | User preferences (nullable) |
| created_at | timestamptz | Account creation time |
| updated_at | timestamptz | Last profile update |

**Settings JSONB structure:**
```json
{
  "llm": {
    "provider": "minimax",
    "model": "MiniMax-M2.1"
  },
  "timezone": "America/New_York"
}
```

**RLS Policies:**
- Users can view their own profile
- Users can update their own profile

### conversations

Chat threads between user and assistant. Each user has one conversation (unified across channels).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner of conversation |
| title | text | Auto-generated or user-set title (nullable) |
| compacted_through | timestamptz | Messages before this are compacted (nullable) |
| created_at | timestamptz | Thread creation time |
| updated_at | timestamptz | Last message time |

**RLS Policies:**
- Users can CRUD their own conversations

### messages

Individual messages within conversations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| conversation_id | uuid | Parent conversation |
| role | text | 'user', 'assistant', or 'system' |
| content | text | Message text |
| metadata | jsonb | Additional data (nullable) |
| created_at | timestamptz | Message timestamp |

**Metadata structure:**
```json
{
  "source": "web | telegram | scheduled",
  "thinking": "...",
  "cards": [...],
  "confirmation": {...},
  "type": "compaction"
}
```

**RLS Policies:**
- Users can view/create messages in their own conversations

### integrations

OAuth tokens and channel connections for third-party services.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Token owner |
| provider | text | 'google', 'telegram', 'microsoft' |
| access_token | text | OAuth access token (or Telegram chat_id) |
| refresh_token | text | OAuth refresh token (nullable) |
| expires_at | timestamptz | Token expiration |
| scopes | text[] | Granted OAuth scopes |
| created_at | timestamptz | Connection time |
| updated_at | timestamptz | Last token refresh |

**RLS Policies:**
- Users can CRUD their own integrations

### user_memories

Long-term memory for the AI assistant, keyed by topic.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Memory owner |
| topic | text | Memory topic (e.g. "preferences", "work") |
| content | text | Memory content |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time |

**Constraints:**
- Unique index on `(user_id, topic)` — one entry per topic per user

**RLS Policies:**
- Users can CRUD their own memories

### scheduled_tasks

One-time and recurring tasks created by the assistant.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Task owner |
| type | text | 'once' or 'recurring' |
| cron_expression | text | For recurring: cron format (nullable) |
| run_at | timestamptz | For one-time: when to run (nullable) |
| description | text | What the agent should do |
| enabled | boolean | Whether task is active (default true) |
| last_run_at | timestamptz | Last execution time (nullable) |
| created_at | timestamptz | Creation time |

**RLS Policies:**
- Users can CRUD their own tasks

### telegram_link_tokens

Temporary tokens for linking Telegram accounts. Short-lived (10 min TTL).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User requesting link |
| token | text | Unique link token |
| expires_at | timestamptz | Token expiration (10 min) |
| created_at | timestamptz | Creation time |

**Constraints:**
- Unique index on `token`

**RLS Policies:**
- Users can create tokens for themselves
- Cleaned up periodically or consumed on use

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE UNIQUE INDEX idx_user_memories_user_topic ON user_memories(user_id, topic);
CREATE INDEX idx_scheduled_tasks_user_id ON scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_run_at ON scheduled_tasks(run_at) WHERE enabled = true;
CREATE UNIQUE INDEX idx_telegram_link_tokens_token ON telegram_link_tokens(token);
```

## Triggers

### on_auth_user_created

Automatically creates a user profile when someone signs up.

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

### update_*_updated_at

Automatically updates `updated_at` timestamp on row changes.

```sql
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
```

## TypeScript Types

See `src/lib/types/database.ts` for TypeScript definitions matching this schema.

## Migration Notes

Migrations are stored in `supabase/migrations/` and should be run via the Supabase SQL Editor.

**Naming convention:** `NNN_description.sql` (e.g., `001_initial_schema.sql`)

**To add a new migration:**

1. Create new file: `supabase/migrations/NNN_description.sql`
2. Write SQL with rollback comments
3. Test in development project first
4. Run in production via SQL Editor
5. Update TypeScript types to match
