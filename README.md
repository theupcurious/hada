# Hada

Hada is a multi-channel assistant app built around an in-app agent loop. It supports web chat, Telegram, scheduled runs, long-term memory, an internal topic-segmentation layer for long threads, a docs workspace, and a dashboard/settings control surface.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Supabase Auth + Postgres + RLS
- Local agent runtime in `src/lib/chat/agent-loop.ts`
- Registry-based tools in `src/lib/chat/tools/`
- Shared orchestration in `src/lib/chat/process-message.ts`

## Implemented Capabilities

- Streaming chat over SSE (`/api/chat`)
- Regeneration of assistant messages (via `/api/chat` + `regenerateAssistantMessageId`)
- Background job queue for long requests (`background_jobs`, `background_job_events`)
- Tool call traces, step/plan traces, and delegation traces in chat UI
- Single visible conversation per user with internal topic segments (`conversation_segments`)
- Ranked context retrieval across active-segment recency, segment summaries, long-term memories, and durable segment artifacts
- Long-term memory (`user_memories`) with semantic recall + text fallback
- Documents workspace (`/docs`) with markdown editor, foldering, upload, share links, and an LLM-maintained personal wiki
- Durable long-form outputs stored as segment artifacts (`segment_artifacts`)
- Smart card rendering (`comparison`, `steps`, `checklist`)
- Follow-up suggestions after web chat responses
- Google Calendar integration (OAuth + list/create/update/delete event tools)
- Telegram account linking and webhook-based chat
- Scheduled tasks (`once`, `recurring`) processed by `/api/cron`
- Dashboard APIs for activity, analytics, tasks, and memories
- App locale support for `en`, `ko`, `ja`, and `zh`, with per-turn language override based on the latest user message

## Tooling

Current registered tools:

- `save_memory`, `recall_memory`
- `web_search`, `web_fetch`
- `schedule_task`
- `plan_task`, `delegate_task`
- `render_card`
- `list_documents`, `read_document`, `create_document`, `update_document`, `search_documents`, `delete_document`
- `mcp_call`
- `list_calendar_events`, `create_calendar_event`, `update_calendar_event`, `delete_calendar_event`

## Quick Start

### 1. Prerequisites

- Node.js `>=20.9.0`
- npm
- Supabase project
- At least one LLM API key

### 2. Install

```bash
npm install
```

### 3. Configure env

```bash
cp .env.local.example .env.local
```

Required:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_PROVIDER`
- `LLM_API_KEY` (or provider-specific `<PROVIDER>_API_KEY`)

Supported providers in code:

- `openrouter`, `minimax`, `openai`, `anthropic`, `gemini`, `kimi`, `deepseek`, `groq`, `mimo`

Optional:

- `LLM_MODEL`, `LLM_BASE_URL`
- `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`
- `ADMIN_USER_EMAILS` or `ADMIN_EMAILS` (enables per-user provider/model settings UI)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
- `SEARCH_PROVIDER`, `SEARCH_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, `SERPAPI_API_KEY`
- `CRON_SECRET`

### 4. Run migrations

Fresh install:

- Run [schema.sql](/Users/james/Projects/Coding/hada/supabase/schema.sql) once in Supabase SQL Editor.

Existing database upgrades:

- Apply all files in `supabase/migrations` in filename order. Current chain:

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
11. `011_document_shares.sql`
12. `012_conversation_segments.sql`
13. `013_memory_classes.sql`
14. `014_segment_artifacts.sql`

Important:

- `supabase/schema.sql` is for brand-new databases only.
- Existing databases should keep using incremental migrations.
- `014_segment_artifacts.sql` depends on `012_conversation_segments.sql` and is not a standalone migration.
- If you apply migrations manually in Supabase SQL editor, preserve the repo order above.

### 5. Run app

```bash
npm run dev
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/chat`
- `http://localhost:3000/docs`
- `http://localhost:3000/settings`

## Verification

```bash
npm run lint
npm run test
npm run build
```

## API Surfaces

- `POST /api/chat` - SSE chat + background-job enqueue path
- `GET /api/background-jobs/[id]` - poll queued job events/results
- `POST /api/background-jobs/[id]/run` - run a queued job
- `GET /api/conversations/messages` - paginated message history
- `DELETE /api/conversations` - clear current chat conversation + web run activity
- `POST /api/messages/[id]/feedback` - thumbs up/down metadata
- `GET|POST /api/documents`, `GET|PATCH|DELETE /api/documents/[id]`
- `POST|DELETE /api/documents/[id]/share`
- `GET /api/shared/documents/[shareId]`
- `GET /api/tools` - tool manifests + integration connection status
- `GET /api/dashboard/activity`
- `GET /api/dashboard/analytics`
- `GET|POST /api/dashboard/memories`, `PATCH|DELETE /api/dashboard/memories/[id]`
- `GET /api/dashboard/tasks`, `PATCH|DELETE /api/dashboard/tasks/[id]`, `POST /api/dashboard/tasks/[id]/run` (currently returns 501 intentionally)
- `GET|DELETE /api/integrations/google`
- `GET|POST /api/integrations/telegram/link`
- `GET /api/openrouter/models`
- `GET /api/debug/context` - admin-only context/memory/segment inspection
- `GET /api/health`
- `POST|GET /api/cron`
- `POST /api/webhooks/telegram`

## Notes

- Long requests are classified in `src/lib/chat/runtime-budgets.ts` and may be queued into `background_jobs`.
- Ranked context retrieval is enabled by default and can be disabled with `HADA_ENABLE_RANKED_CONTEXT_RETRIEVAL=0`.
- Hada still uses one visible conversation per user, but prompt assembly is no longer purely flat-recency based.
- Tool permissions are enforced by `DEFAULT_POLICY` in `src/lib/chat/tool-permissions.ts`.
- Provider/model user overrides are only applied for admin emails (`ADMIN_USER_EMAILS` / `ADMIN_EMAILS`).
- `render_card` currently supports only `comparison`, `steps`, and `checklist`.
- Schedule/table cards render in UI when card payloads exist in `messages.metadata.cards`; they are not automatically generated by `web_search` today.

## Docs

- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/SETUP.md`
