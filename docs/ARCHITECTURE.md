# Architecture

## Overview

Hada is a Next.js App Router application with an in-process agent runtime.

Design priorities in the current implementation:

1. Single runtime path for all channels (`web`, `telegram`, `scheduled`)
2. Supabase-backed persistence with RLS isolation
3. Real-time UX via SSE for chat and poll/replay for long background runs
4. One visible user thread with internal topic segmentation and bounded context retrieval
5. Registry-based tool extension with explicit per-tool risk policy

## System Topology

```text
Users
  ├─ Web UI (/, /chat, /docs, /settings)
  ├─ Telegram Bot
  └─ Cron Scheduler

Next.js App
  ├─ App Router pages/components
  ├─ API routes
  │   ├─ /api/chat
  │   ├─ /api/background-jobs/*
  │   ├─ /api/conversations/*
  │   ├─ /api/messages/[id]/feedback
  │   ├─ /api/documents/*
  │   ├─ /api/integrations/*
  │   ├─ /api/dashboard/*
  │   ├─ /api/tools
  │   ├─ /api/openrouter/models
  │   ├─ /api/health
  │   ├─ /api/cron
  │   └─ /api/webhooks/telegram
  └─ Runtime libs
      ├─ processMessage()
      ├─ agentLoop()
      ├─ buildSystemPrompt()
      ├─ segment router + context hinting
      ├─ ranked context retrieval + legacy recency fallback
      ├─ segment summaries + segment artifacts
      ├─ context manager + compaction
      ├─ memory extraction / embeddings
      └─ tool registry + tool implementations

Supabase
  ├─ Auth
  └─ Postgres (users, conversations, messages, conversation_segments, user_memories, segment_artifacts, tasks, docs, runs, background jobs)

External services
  ├─ LLM providers
  ├─ Web search providers
  ├─ Google OAuth + Calendar APIs
  └─ Telegram Bot API
```

## Core Request Flows

### Web Chat (`POST /api/chat`)

- Authenticates user via Supabase session.
- Supports two entry modes:
  - Normal message (`message`)
  - Regeneration (`regenerateAssistantMessageId`)
- Streams events over SSE (`text/event-stream`).

Execution split:

- Direct run: calls `processMessage()` and streams events live.
- Long-form run: if `isLongJobMessage(message)` returns true, enqueues `background_jobs`, emits a `background_job` event, and exits request quickly.

Long-job trigger (current code):

- Message length `>= 180` chars, or
- Includes hints like `research`, `deep dive`, `memo`, `analyze`, `compare`, `latest news`, etc.

### Background Jobs

- Queued by `/api/chat` via `enqueueBackgroundJob()`.
- Kicked by post-response callback to `/api/background-jobs/[id]/run?token=...`.
- Also drained by `/api/cron` (`processQueuedBackgroundJobs`).
- Progress is stored as `background_job_events` and replayed by polling `GET /api/background-jobs/[id]?after=<seq>`.

### Telegram

- Webhook endpoint: `POST /api/webhooks/telegram`.
- Verifies `x-telegram-bot-api-secret-token` when `TELEGRAM_WEBHOOK_SECRET` is set.
- `/start <token>` links chat to a user via `telegram_link_tokens` + `integrations`.
- Regular text messages run through `processMessage(source="telegram")`.

### Scheduled Runs (`/api/cron`)

- Optional auth with `x-cron-secret` if `CRON_SECRET` is configured.
- Executes due `scheduled_tasks` (`once` + cron-like `recurring`).
- Sends scheduled output to Telegram when linked.
- Also processes queued background jobs.

## Runtime Layers

### 1. `processMessage()`

`src/lib/chat/process-message.ts` orchestrates end-to-end execution:

- Resolve/create conversation
- Persist user message
- Build tool context + available tools
- Build system prompt (persona, locale, per-turn language override, memory, integrations, preferences)
- Compute a segment context hint for the current turn
- Retrieve ranked conversation context when enabled
- Resolve provider/model selection
- Select run budgets
- Execute `agentLoop()`
- Persist assistant message + metadata
- Persist `agent_runs` telemetry
- Fire-and-forget follow-up suggestion generation
- Fire-and-forget post-turn memory extraction
- Fire-and-forget segment decision persistence
- Fire-and-forget segment summary refreshes
- Fire-and-forget segment artifact persistence
- Fire-and-forget conversation compaction checks

### 2. `agentLoop()`

`src/lib/chat/agent-loop.ts` handles iterative tool-using generation.

Key behaviors:

- Streams model output (`text_delta`) and terminal `done` event
- Enforces hard and idle timeouts
- Emits tool and planning events for UI traces
- Runs `plan_task` calls sequentially
- Runs all other tool calls in parallel (`Promise.allSettled`)
- Applies permission policy before execution
- Performs mid-run compaction when messages exceed ~75% of provider context window
- Performs intra-run context trimming (`MAX_RUN_CONTEXT_TOKENS = 80_000`)
- Sanitizes internal reasoning tags from user-visible output
- Extracts and strips hidden internal segment metadata markers from the final response path

### 3. Tool Registry + Policy

- Registry: `src/lib/chat/tools/tool-registry.ts`
- Registration: `src/lib/chat/tools/index.ts`
- Policy: `src/lib/chat/tool-permissions.ts`

Default policy:

- Risk defaults: `low=allow`, `medium=allow`, `high=confirm`
- Rate limit: `delegate_task` max 3 calls/run
- `confirm` currently executes (with event plumbing for a future UI confirmation flow)

Current registered tools:

- Memory: `save_memory`, `recall_memory`
- Web: `web_search`, `web_fetch`
- Scheduling/system: `schedule_task`, `plan_task`, `delegate_task`
- Documents & Wiki: `list_documents`, `read_document`, `create_document`, `update_document`, `search_documents`, `delete_document`
- Structured output: `render_card`
- Integration bridge: `mcp_call`
- Google Calendar: `list_calendar_events`, `create_calendar_event`, `update_calendar_event`, `delete_calendar_event`

### 4. Prompt Assembly

`buildSystemPrompt()` combines:

- Base prompt (`src/lib/chat/prompts/system.md`)
- Persona + custom instructions
- Onboarding-derived working style/preferences
- Locale/language guidance from saved settings
- Per-turn language override based on the latest user message (`en`, `ko`, `ja`, `zh`)
- Available tool list
- User context (name/email/tier/integrations/timezone/local time)
- Long-term memory summary with class-aware gating
- Channel context (`web` / `telegram` / `scheduled`)
- Internal topic-segment instructions for the model
- LLM Wiki schema (dynamically injected only if the user has an active `wiki/` folder)

For Anthropic, stable/dynamic prompt parts are passed separately to enable prompt-caching behavior.

### 5. Topic Segments and Context Retrieval

Hada still keeps a single visible conversation thread per user, but the runtime no longer treats that thread as one flat prompt transcript.

Current flow:

1. `computeContextHint()` inspects the active segment plus recent closed segments.
2. `agentLoop()` emits a hidden segment signal (`continue`, `new`, `revive`) in the model output.
3. `persistSegmentDecision()` attaches both the user and assistant messages to a `segment_id`, creating or reviving a segment as needed.
4. `retrieveRankedConversationContext()` assembles bounded prompt context from:
   - active-segment recent messages
   - active-segment summary
   - relevant older segment summaries
   - class-aware long-term memories
   - durable segment artifacts
5. If ranked retrieval fails or is disabled, Hada falls back to `assembleConversationContext()` recency-based assembly.

Ranked retrieval is enabled by default and can be disabled with `HADA_ENABLE_RANKED_CONTEXT_RETRIEVAL=0`.

### 6. Memory Pipeline

Long-term memory table: `user_memories`.

Write paths:

1. Explicit `save_memory` tool
2. Pre-compaction extraction (`flushMemoriesBeforeCompaction`)
3. Post-turn extraction (`extractMemoriesFromTurn`)

Read path:

- `recall_memory` first tries semantic search (`match_user_memories` via pgvector), then text fallback.
- Prompt assembly globally injects pinned/profile/preference memories that fit the memory budget.
- Ranked retrieval can additionally pull project/archive memories when they are relevant to the current segment set.

Embeddings are optional:

- If embedding generation fails or keys are missing, text memories still persist.

### 7. Segment Summaries and Artifacts

- Segment summaries are refreshed asynchronously by `queueSegmentSummaryRefresh()` when a segment is closed, revived, or has grown enough since the previous summary.
- `maybeCompactConversation()` is segment-aware: it prefers compacting runs of messages within the same `segment_id` boundary instead of mixing unrelated topics.
- Long-form outputs can be persisted to `segment_artifacts` so future turns can recall the artifact summary instead of replaying the full research transcript.

## UI Architecture

### `/chat`

Primary assistant UI with:

- SSE streaming content
- Trace timeline (tools, thinking, delegation)
- Task plan card rendering
- Tool status pills
- Regenerate + feedback actions
- Follow-up suggestion chips
- Document attach picker
- Artifact side panel for document tool output
- Language-aware responses based on saved locale plus latest-message override

### `/docs`

Document workspace with:

- User-scoped document CRUD
- Folder grouping (`folder` column)
- Tiptap markdown editing with `[[wikilink]]` support
- `.md` and `.txt` upload (global and wiki-specific drop zones)
- LLM-maintained personal wiki in the `wiki/` folder with strict schema rules
- Interactive SVG graph visualization of wiki pages and their connections
- Share link creation and public shared-doc view
- Deep-linking navigation and click-to-traverse wiki links

### `/settings`

Tab surfaces:

- Integrations
- Account/profile + provider/persona/preferences
- Memory management
- Scheduled task management
- Runtime status

### `/` (home)

Marketing/entry page; auth flows route users to chat/settings/docs surfaces.

## Data and Observability

Persisted telemetry and state:

- `messages` holds conversation content + metadata
- `conversation_segments` tracks internal topic boundaries, summaries, and activity
- `agent_runs` stores per-run status/duration/tool call summaries
- `background_jobs` + `background_job_events` store long-run state and replayable events
- `segment_artifacts` stores durable outputs tied to topic segments

Live-only state (not relationally normalized):

- Per-run plan/delegation timeline state
- Intermediate reasoning/status stream details

## Security Model

- Supabase Auth for user identity/session.
- RLS on user-owned tables (`auth.uid() = user_id` semantics).
- Service-role client is used in trusted server contexts (cron/webhook/background processing).
- Telegram webhook optionally protected with shared secret header.
- Cron endpoint optionally protected with `CRON_SECRET` header.

## Current Constraints / Intentional Gaps

- `POST /api/dashboard/tasks/[id]/run` intentionally returns `501` (manual immediate task run is not wired yet).
- Schedule/table cards only render when card payloads are present in `messages.metadata.cards`; `web_search` does not auto-emit those payloads today.
- User-level provider/model overrides are admin-only by design.
- The memory schema supports classes (`profile`, `project`, `preference`, `archive`), but not every write path classifies memories automatically yet.
