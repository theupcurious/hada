# Hada

Hada is an AI assistant web app with a built-in agent loop. It supports web chat, Telegram chat, long-term memory, tool usage (calendar/search/fetch/scheduling), and scheduled task execution.

## Current Architecture

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Auth + Postgres + RLS)
- Built-in agent loop in `src/lib/chat/agent-loop.ts`
- Multi-provider LLM support via `src/lib/chat/providers.ts`
- Shared message pipeline in `src/lib/chat/process-message.ts`
- Telegram channel via webhook + deep-link account linking

## Key Features

- Persistent per-user conversation history
- Long-term memory (`user_memories`)
- Context management with sliding window + compaction
- Web tools:
  - `web_search`
  - `web_fetch`
- Calendar tools (Google integration)
- Scheduled one-time and recurring tasks (`/api/cron`)
- Telegram integration (bidirectional)

## Quick Start

### Prerequisites

- Node.js 20.9+ (`package.json` engines)
- Supabase project
- At least one LLM API key

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.local.example .env.local
```

Fill required values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `LLM_PROVIDER` and matching API key (for example `MINIMAX_API_KEY`)

Optional:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` / `TELEGRAM_BOT_USERNAME`
- `SEARCH_PROVIDER` / `SEARCH_API_KEY`
- `CRON_SECRET`

### Database setup

Run migrations in Supabase SQL editor:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_add_user_permissions.sql`
- `supabase/migrations/004_agent_and_telegram.sql`

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build & Lint

```bash
npm run lint
npm run build
```

If Turbopack build is restricted in your environment, use:

```bash
npx next build --webpack
```

## Important Paths

- `src/app/api/chat/route.ts` - web chat API
- `src/app/api/webhooks/telegram/route.ts` - Telegram webhook
- `src/app/api/cron/route.ts` - scheduled task runner
- `src/lib/chat/agent-loop.ts` - core runtime loop
- `src/lib/chat/tools/` - tool implementations
- `src/lib/telegram/` - Telegram utilities
- `docs/ROADMAP.md` - product roadmap
- `CHANGELOG.md` - change history
