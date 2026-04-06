# Hada

Hada is an assistant application built around a local agent loop. It supports web chat, Telegram, long-term memory, scheduled tasks, live trace streaming, multi-step planning, specialist sub-agent delegation, background research jobs for long requests, rich inline output cards, a settings surface, and a dashboard control plane. The agent loop runs tool calls in parallel, enforces a permission/risk policy per tool, and manages context size automatically within each run.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase Auth + Postgres + RLS
- Built-in agent loop in `src/lib/chat/agent-loop.ts`
- Registry-backed tools in `src/lib/chat/tools/` with risk-level manifests
- Tool permission policy in `src/lib/chat/tool-permissions.ts`
- Shared orchestration pipeline in `src/lib/chat/process-message.ts`
- Multi-provider LLM support in `src/lib/chat/providers.ts` (with per-provider context window config)

## What’s Implemented

- Persistent per-user conversation history
- Inline chat execution traces with tool calls, reasoning status, and latencies
- Progress-aware timeout handling with larger budgets for long-form research/memo jobs
- Background execution for long-form research/memo jobs, with persisted progress events and chat polling
- **Parallel tool execution**: when the model returns multiple tool calls, they run concurrently via `Promise.allSettled` (`plan_task` still runs first to protect plan state)
- **Intra-run context trimming**: sliding window trims the middle of accumulated tool messages when the run exceeds 80k tokens, keeping initial context and the most recent turns
- **Mid-run compaction**: reactive compaction fires at the start of each loop iteration when `llmMessages` exceeds 75% of the provider's context window
- **Tool permission gates**: every tool call is checked against `DEFAULT_POLICY` before execution — risk level (low/medium/high) is baked into each tool manifest, `delegate_task` is capped at 3 calls per run, and high-risk tools default to `"confirm"` (infrastructure for a future UI confirmation step)
- **Prompt caching**: system prompt is split into a stable segment (base prompt, persona, tools) and a dynamic segment (user context, memory, date). Anthropic calls send both as a two-element system array with `cache_control` on the stable part to reduce cost and latency
- Multi-step task planning via `plan_task`
- Specialist delegation via `delegate_task`
- Long-term memory via `user_memories`
- Automatic memory capture before compaction and after completed turns
- Semantic memory recall via pgvector embeddings with text-search fallback
- Web tools: `web_search`, `web_fetch`
- **Hada Canvas**: Side-by-side collaborative document co-authoring with `create_document` and `update_document`
- **MCP Support**: Model Context Protocol bridge via `mcp_call` for external tool integration
- **Proactive Time Defense**: Advanced scheduling in the `scheduler` agent to protect focus time and preempt conflicts
- Rich inline cards for supported structured outputs in chat
- **Smart cards**: `render_card` tool produces structured comparison, steps, and checklist cards directly in chat
- **Follow-up suggestions**: Contextual prompt chips generated after each assistant response
- **Tool status pills**: Live streaming indicators showing active search, fetch, and delegation work
- **Message regeneration**: Re-run any assistant turn with the same or revised prompt
- **Doc attach**: Attach documents from the `/docs` workspace directly into a chat message for context
- **Welcome-first chat landing**: Refresh/login opens the greeting + starter prompts view by default, with an explicit "Continue last chat" action
- **Reasoning output hygiene**: Internal model reasoning tags (for example `<think>` / `<thought>`) are suppressed from user-visible responses
- **Gemini tool-call compatibility**: Preserves `extra_content.google.thought_signature` across tool-call turns for Gemini models that require it
- Google Calendar tools
- Scheduled one-time and recurring tasks
- Telegram integration with account linking
- Agent personas (Balanced, Concise, Friendly, Professional, Academic) and custom instructions, configurable per user in Settings
- Settings at `/settings` for runtime status, integrations, preferences, persona, memory management, and chat reset
- Documents workspace at `/docs` for RAG context and co-authored artifacts
- Responsive chat/settings/docs layouts tuned for mobile and narrow viewports

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
- `LLM_PROVIDER` — one of `openrouter`, `minimax`, `anthropic`, `openai`, `gemini`, `kimi`, `deepseek`, `groq`
- `LLM_API_KEY` — API key for the selected provider (all providers share this single key)

Common optional values:
- `LLM_MODEL` — override the provider's default model
- `LLM_BASE_URL` — override the provider's default base URL (useful for OpenRouter or self-hosted endpoints)
- `EMBEDDING_API_KEY` — embedding API key, falls back to `LLM_API_KEY`
- `EMBEDDING_BASE_URL` — embedding endpoint override
- `EMBEDDING_MODEL` — embedding model override, defaults to `text-embedding-3-small`
- `ADMIN_USER_EMAILS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_USERNAME`
- `SEARCH_PROVIDER` — one of `tavily`, `brave`, `serpapi`
- `SEARCH_API_KEY`
- `CRON_SECRET`

### Database setup

Run these migrations in Supabase SQL Editor in order:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_add_user_permissions.sql`
- `supabase/migrations/004_agent_and_telegram.sql`
- `supabase/migrations/005_agent_runs.sql`
- `supabase/migrations/006_background_jobs.sql`
- `supabase/migrations/007_memory_embeddings.sql`
- `supabase/migrations/008_messages_update_policy.sql`
- `supabase/migrations/009_default_openrouter_provider.sql`
- `supabase/migrations/010_documents.sql`
- `supabase/migrations/011_agent_runs_delete_policy.sql`

Notes:
- `007_memory_embeddings.sql` is required for semantic memory recall and adds the `match_user_memories` function plus the `user_memories.embedding` column.
- Embedding generation requires an API key that supports the embeddings endpoint. Set `EMBEDDING_API_KEY` (or `LLM_API_KEY` if your provider supports it) for semantic memory save/recall paths. Without it, memory still works via keyword search.

### Run locally

```bash
npm run dev
```

Open:
- `http://localhost:3000/chat`
- `http://localhost:3000/docs`
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
- `src/app/api/conversations/` - conversation management API
- `src/app/api/messages/` - message management API (regeneration, feedback)
- `src/app/api/documents/` - documents workspace API
- `src/app/api/tools/route.ts` - tool manifest introspection
- `src/app/api/dashboard/` - dashboard data APIs (activity, analytics, memories, tasks)
- `src/app/api/integrations/` - integration management API
- `src/app/api/openrouter/models/` - OpenRouter model list API
- `src/app/api/health/` - health check
- `src/app/api/webhooks/telegram/route.ts` - Telegram webhook
- `src/app/api/cron/route.ts` - scheduled task runner
- `src/app/chat/page.tsx` - chat UI
- `src/app/docs/page.tsx` - documents workspace UI
- `src/lib/chat/agent-loop.ts` - core runtime loop (parallel execution, context trimming, compaction)
- `src/lib/chat/tool-permissions.ts` - permission policy and risk-level gating
- `src/lib/chat/process-message.ts` - orchestration + telemetry
- `src/lib/chat/card-extraction.ts` - tool-result to rich-card extraction
- `src/lib/chat/memory-extraction.ts` - post-turn memory extraction
- `src/lib/chat/follow-up-suggestions.ts` - post-turn follow-up chip generation
- `src/lib/chat/tool-status.ts` - streaming tool status pill logic
- `src/lib/chat/regenerate-message.ts` - message regeneration helper
- `src/lib/chat/personas.ts` - pre-built persona profiles and lookup helper
- `src/lib/chat/embeddings.ts` - embedding generation helper
- `src/lib/chat/runtime-budgets.ts` - normal vs long-job budget selection
- `src/lib/background-jobs.ts` - queueing, processing, and polling helpers
- `src/lib/chat/tools/` - tool implementations
- `src/lib/chat/agents/profiles.ts` - sub-agent profile definitions
- `src/components/chat/agent-trace.tsx` - trace/delegation UI
- `src/components/chat/artifact-panel.tsx` - Hada Canvas side-panel
- `src/components/chat/task-plan-card.tsx` - plan UI
- `src/components/chat/search-results-card.tsx` - rich search result renderer
- `src/components/chat/schedule-view-card.tsx` - rich schedule renderer
- `src/components/chat/data-table-card.tsx` - rich table renderer
- `src/components/chat/smart-cards/` - smart card components (comparison, steps, checklist)
- `src/components/chat/follow-up-chips.tsx` - follow-up suggestion chips
- `src/components/chat/tool-status-pills.tsx` - streaming tool activity indicators
- `docs/ARCHITECTURE.md` - architecture overview
- `docs/DATABASE.md` - schema overview

## Notes

- The Settings memory tab and the Dashboard memory manager both operate on the same `user_memories` table the agent uses during runtime.
- `web_search` results are automatically converted into rich inline cards; the schedule/table renderers are implemented but still need prompt/tool-side structured payload emission before they appear automatically.
- `/api/chat` is an SSE endpoint with `maxDuration = 300`; long research-style prompts are queued into background jobs instead of trying to complete inside one request.
- Background job progress is persisted in `background_job_events` and replayed into chat by polling `/api/background-jobs/[id]`.
- Dashboard task `Run now` is intentionally guarded until immediate execution is wired through the scheduler path.
- Next.js currently emits a `middleware` → `proxy` deprecation warning during build; the app still builds successfully.
- **Hada Canvas**: Document creation/updates automatically open a side-by-side workspace in the web chat.
- **Time Defense**: The `scheduler` sub-agent is instructed to proactively protect deep work blocks and identify schedule conflicts.
- **OpenRouter** is the default provider. Set `LLM_PROVIDER=openrouter` and `LLM_API_KEY=<your-openrouter-key>` to use it. Any other listed provider works by changing `LLM_PROVIDER` and setting `LLM_API_KEY` to that provider's key.
- **Smart cards**: `render_card` emits `comparison`, `steps`, and `checklist` card types. Card payloads are stored in `messages.metadata.cards` alongside `search_results`, `schedule_view`, and `data_table`.
- **Follow-up suggestions** are generated fire-and-forget after each turn and rendered as clickable chips below the assistant response. They are not persisted.
- **Parallel tool execution**: `plan_task` always runs first; all other tool calls in a batch execute concurrently. UI receives all `tool_call` events before any results land.
- **Permission policy**: `DEFAULT_POLICY` in `tool-permissions.ts` is passed into every `agentLoop()` call. To restrict or rate-limit a specific tool, add a `toolOverrides` or `maxCallsPerTool` entry to a custom policy and pass it in `AgentLoopOptions`.
- **Prompt caching** requires Anthropic as the provider. The `anthropic-beta: prompt-caching-2024-07-31` header is sent automatically when `systemPromptParts` is present. No configuration needed — it activates whenever `LLM_PROVIDER=anthropic`.
- **Reasoning traces vs response text**: The UI can show high-level thinking status events, but raw chain-of-thought content is sanitized before assistant text is displayed.
- **Gemini thought signatures**: Gemini function-calling turns that emit `extra_content.google.thought_signature` are replayed with that signature on subsequent tool turns to avoid 400 validation errors.
