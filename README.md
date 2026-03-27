# Hada

Hada is an assistant application built around a local agent loop. It supports web chat, Telegram, long-term memory, scheduled tasks, live trace streaming, multi-step planning, specialist sub-agent delegation, background research jobs for long requests, rich inline output cards, a settings surface, and a dashboard control plane.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase Auth + Postgres + RLS
- Built-in agent loop in `src/lib/chat/agent-loop.ts`
- Registry-backed tools in `src/lib/chat/tools/`
- Shared orchestration pipeline in `src/lib/chat/process-message.ts`
- Multi-provider LLM support in `src/lib/chat/providers.ts`

## What’s Implemented

- Persistent per-user conversation history
- Inline chat execution traces with tool calls, reasoning, and latencies
- Progress-aware timeout handling with larger budgets for long-form research/memo jobs
- Background execution for long-form research/memo jobs, with persisted progress events and chat polling
- Multi-step task planning via `plan_task`
- Specialist delegation via `delegate_task`
- Long-term memory via `user_memories`
- Automatic memory capture before compaction and after completed turns
- Semantic memory recall via pgvector embeddings with text-search fallback
- Web tools: `web_search`, `web_fetch`
- Rich inline cards for supported structured outputs in chat
- Google Calendar tools
- Scheduled one-time and recurring tasks
- Telegram integration with account linking
- Settings at `/settings` for runtime status, integrations, preferences, memory management, and chat reset
- Dashboard at `/dashboard` for activity, analytics, memories, and tasks
- Responsive chat/settings layouts tuned for mobile and narrow viewports

## Quick Start

### Prerequisites

- Node.js 20.9+
- Supabase project
- At least one supported LLM API key

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.local.example .env.local
```

Required values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `LLM_PROVIDER`
- a matching provider API key, for example `MINIMAX_API_KEY`

Common optional values:
- `LLM_API_KEY` as a shared fallback key
- `ADMIN_USER_EMAILS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_USERNAME`
- `SEARCH_PROVIDER`
- `SEARCH_API_KEY`
- provider-specific search keys such as `TAVILY_API_KEY`, `BRAVE_API_KEY`, or `SERPAPI_API_KEY`
- `CRON_SECRET`

Provider-specific LLM keys currently supported:
- `MINIMAX_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `KIMI_API_KEY`
- `MOONSHOT_API_KEY`
- `DEEPSEEK_API_KEY`
- `GROQ_API_KEY`

### Database setup

Run these migrations in Supabase SQL Editor:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_add_user_permissions.sql`
- `supabase/migrations/004_agent_and_telegram.sql`
- `supabase/migrations/005_agent_runs.sql`
- `supabase/migrations/006_background_jobs.sql`
- `supabase/migrations/007_memory_embeddings.sql`

Notes:
- `007_memory_embeddings.sql` is required for semantic memory recall and adds the `match_user_memories` function plus the `user_memories.embedding` column.
- `OPENAI_API_KEY` is optional overall, but it is required if you want embedding generation for semantic memory save/recall paths.

### Run locally

```bash
npm run dev
```

Open:
- `http://localhost:3000/chat`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/settings`

## Verification

```bash
npm run lint
npm run build
```

## Important Paths

- `src/app/api/chat/route.ts` - web chat SSE API
- `src/app/api/background-jobs/[id]/route.ts` - background job poll API
- `src/app/api/background-jobs/[id]/run/route.ts` - background job processor trigger
- `src/app/api/tools/route.ts` - tool manifest introspection
- `src/app/api/dashboard/` - dashboard APIs
- `src/app/api/webhooks/telegram/route.ts` - Telegram webhook
- `src/app/api/cron/route.ts` - scheduled task runner
- `src/app/chat/page.tsx` - chat UI
- `src/app/dashboard/page.tsx` - dashboard UI
- `src/lib/chat/agent-loop.ts` - core runtime loop
- `src/lib/chat/process-message.ts` - orchestration + telemetry
- `src/lib/chat/card-extraction.ts` - tool-result to rich-card extraction
- `src/lib/chat/memory-extraction.ts` - post-turn memory extraction
- `src/lib/chat/embeddings.ts` - OpenAI embedding generation helper
- `src/lib/chat/runtime-budgets.ts` - normal vs long-job budget selection
- `src/lib/background-jobs.ts` - queueing, processing, and polling helpers
- `src/lib/chat/tools/` - tool implementations
- `src/lib/chat/agents/` - sub-agent profiles
- `src/components/chat/agent-trace.tsx` - trace/delegation UI
- `src/components/chat/task-plan-card.tsx` - plan UI
- `src/components/chat/search-results-card.tsx` - rich search result renderer
- `src/components/chat/schedule-view-card.tsx` - rich schedule renderer
- `src/components/chat/data-table-card.tsx` - rich table renderer
- `docs/ARCHITECTURE.md` - architecture overview
- `docs/DATABASE.md` - schema overview

## Notes

- The Settings memory tab and the Dashboard memory manager both operate on the same `user_memories` table the agent uses during runtime.
- `web_search` results are automatically converted into rich inline cards; the schedule/table renderers are implemented but still need prompt/tool-side structured payload emission before they appear automatically.
- `/api/chat` is an SSE endpoint with `maxDuration = 300`; long research-style prompts are queued into background jobs instead of trying to complete inside one request.
- Background job progress is persisted in `background_job_events` and replayed into chat by polling `/api/background-jobs/[id]`.
- Dashboard task `Run now` is intentionally guarded until immediate execution is wired through the scheduler path.
- Next.js currently emits a `middleware` → `proxy` deprecation warning during build; the app still builds successfully.
