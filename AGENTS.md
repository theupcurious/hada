# Hada - AI Assistant as a Service

Hada (하다 = "to do" in Korean) is a "Bot as a Service" platform — users get their own AI assistant (web + Telegram) backed by a self-contained agent loop with multi-provider LLM support.

**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Auth), Railway, Framer Motion

## Key Files

- `src/app/chat/page.tsx` — Main chat interface
- `src/app/settings/page.tsx` — Settings (status, integrations, account tabs)
- `src/app/api/chat/route.ts` — Chat API (SSE streaming)
- `src/app/api/webhooks/telegram/route.ts` — Telegram webhook
- `src/app/api/cron/route.ts` — Scheduled task execution
- `src/lib/chat/agent-loop.ts` — Core agent loop (async generator, tool execution, think-filter)
- `src/lib/chat/process-message.ts` — Shared message processing (web, Telegram, cron)
- `src/lib/chat/providers.ts` — LLM provider registry (multi-provider)
- `src/lib/chat/build-system-prompt.ts` — Layered system prompt assembly
- `src/lib/chat/context-manager.ts` — Sliding window + compaction
- `src/lib/chat/tools/index.ts` — Tool registry
- `src/lib/db/conversations.ts` — Conversation & message persistence
- `src/lib/types/database.ts` — TypeScript types matching DB schema
- `src/lib/supabase/server.ts` — Server Supabase client
- `src/lib/telegram/client.ts` — Telegram Bot API wrapper

## Coding Conventions

### TypeScript
- Strict — avoid `any`
- `interface` for objects, `type` for unions/intersections
- `@/` alias for all imports from `src/`

### React / Next.js
- Server Components by default; `"use client"` only for interactivity/hooks
- `export const dynamic = "force-dynamic"` for pages needing runtime data
- App Router only — no Pages Router

### Styling
- Tailwind CSS v4 — uses `@theme` and CSS variables (different from v3)
- shadcn/ui components from `@/components/ui`
- `cn()` for conditional classes; `zinc` palette for neutral grays
- Chat UI: centered input (max-w-3xl), no chat bubbles, empty state with suggestion cards

### Component patterns
- Buttons: shadcn/ui Button with variants (default, ghost, outline)
- Cards: `rounded-xl`, subtle borders, hover states
- Avatars: `h-8 w-8` with initials
- Color scheme: `zinc-50`/`zinc-950` bg, `zinc-200`/`zinc-800` borders, `zinc-500`/`zinc-400` muted text

## Common Tasks

**New agent tool:** Create in `src/lib/chat/tools/`, then register in `tools/index.ts`

**New LLM provider:** Add entry to provider registry in `src/lib/chat/providers.ts`

**New DB table:** Migration in `supabase/migrations/` → types in `src/lib/types/database.ts` → run in Supabase SQL Editor

**New shadcn component:** `npx shadcn@latest add [component-name]`

## Important Gotchas

- Tailwind v4 `@theme` syntax — don't apply v3 patterns
- Use `createAdminClient()` (service role) for server-side writes; `createClient()` for user-scoped reads
- All channels (web, Telegram) share **one conversation per user**
- Agent loop is self-contained — no external AI gateway
- `<think>` blocks and tool-protocol text are filtered before user display (`agent-loop.ts` ThinkFilter)
- `assembleConversationContext` must run **after** `saveMessage` commits — PostgreSQL read-committed isolation causes a race if run in the same `Promise.all`
- Output sanitization: `agent-loop.ts` strips leaked think/tool text; don't bypass this
- Framer Motion is installed — use it for animations
- See `docs/` for detailed architecture, setup, and schema docs
