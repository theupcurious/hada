# Architecture

## Overview

Hada is a multi-tenant assistant application built around a local agent loop. The current system emphasizes:

1. Simplicity: orchestration happens inside the app, without an external AI gateway layer.
2. Multi-channel continuity: web, Telegram, and scheduled runs share the same conversation model.
3. Observability: chat exposes live traces, and `/dashboard` exposes persisted run telemetry.
4. Extensibility: tools are registry-driven and delegation is profile-driven.
5. Security: Supabase Auth plus RLS isolate user data.

## High-Level System

```text
Users (Web / Telegram)
        │
        ▼
Next.js App
  ├─ App Router UI
  │   ├─ /chat
  │   ├─ /dashboard
  │   └─ /settings
  ├─ API Routes
  │   ├─ /api/chat              (SSE stream + background job enqueue)
  │   ├─ /api/background-jobs/*
  │   ├─ /api/documents/*       (Documents workspace CRUD)
  │   ├─ /api/tools
  │   ├─ /api/dashboard/*
  │   ├─ /api/webhooks/telegram
  │   └─ /api/cron
  ├─ Shared orchestration
  │   ├─ processMessage()
  │   ├─ agentLoop()
  │   ├─ buildSystemPrompt()
  │   ├─ context-manager
  │   ├─ card-extraction
  │   ├─ memory-extraction
  │   └─ embeddings
  ├─ Tool registry
  │   ├─ memory tools
  │   ├─ web tools
  │   ├─ calendar tools
  │   ├─ document tools         (list, read, create, update)
  │   ├─ planning tool
  │   ├─ delegation tool
  │   └─ MCP bridge             (mcp_call)
  └─ Sub-agent profiles
      ├─ researcher
      ├─ memory_manager
      └─ scheduler              (Proactive Time Defense)

Storage / services
  ├─ Supabase Postgres + Auth
  ├─ LLM providers
  ├─ Google APIs
  └─ Telegram Bot API
```

## Request Flows

### Web Chat Flow

```text
Chat UI
  → POST /api/chat
  → request budget (`maxDuration = 300`)
  → request classification
     ├─ short/interactive
     │   → processMessage()
     │   → run budget selection
     │   → agentLoop()
     │   → LLM + tools
     │   → SSE events (text, tool, plan, delegation)
     │   → UI updates inline
     │   → final response + telemetry persisted
     └─ long-form research/memo
         → enqueue background_jobs row
         → create placeholder assistant message
         → emit `background_job` SSE event
         → post-response `/api/background-jobs/[id]/run`
         → processMessage() in background
         → persist background_job_events
         → UI polls `/api/background-jobs/[id]`
         → final assistant message updated in place
```

Key properties:
- `/api/chat` returns an SSE stream, not a single JSON blob.
- The frontend updates assistant text, trace cards, task plans, and delegated sub-agent groups in real time for direct runs.
- **Hada Canvas**: When an agent uses `create_document` or `update_document`, the chat UI automatically opens the `ArtifactPanel` side-panel to show the document in real time.
- Long-form research jobs move out of the request path but still surface progress through persisted events and polling.
- The final assistant message and `agent_runs` telemetry are saved after the loop completes.

### Telegram Flow

```text
Telegram webhook
  → /api/webhooks/telegram
  → processMessage()
  → agentLoop()
  → bot send/edit message
  → shared conversation persisted
```

Telegram reuses the same orchestration path as web chat, but adapts output through Telegram-safe formatting and message editing.

### Scheduled Flow

```text
Cron trigger
  → /api/cron
  → scheduled task lookup
  → queued background job pickup
  → processMessage(source="scheduled")
  → shared conversation + downstream delivery
```

## Core Runtime

### `processMessage()`

`src/lib/chat/process-message.ts` is the orchestration entry point. It is responsible for:
- creating/finding the user conversation
- saving or reusing the user message
- resolving integrations and tool availability
- building the system prompt (including persona and custom instructions injection)
- selecting the provider/model
- selecting runtime budgets based on the request shape
- running `agentLoop()`
- persisting or updating the assistant response
- extracting rich cards from tool results and attaching them to assistant message metadata
- triggering pre-compaction memory flushes through `maybeCompactConversation()`
- kicking off post-turn memory extraction in the background
- recording `agent_runs` telemetry

### Rich Output Lifecycle

Structured assistant outputs now flow through two separate paths:

#### 1. Rich Cards (Inline)
- Shared types: `src/lib/types/cards.ts` defines the card payload contracts.
- Server-side extraction: `extractCardsFromToolResults()` inspects tool outputs.
- Rendering: `/chat` renders supported card types (`search_results`, `schedule_view`, etc.) inline.

#### 2. Hada Canvas (Side-panel Artifacts)
- Trigger: The agent calls `create_document` or `update_document`.
- Delivery: Tool results containing `status: "created"` or `status: "updated"` are intercepted by the chat UI.
- Rendering: The `ArtifactPanel` displays the document content side-by-side with the chat.
- Workspace Bridge: Users can click "Full View" to open the document in the `/docs` workspace for dedicated editing.

Current supported automatic extraction:
- `search_results` cards from `web_search`

Current supported renderers:
- `search_results`
- `schedule_view`
- `data_table`

Follow-up gap:
- `schedule_view` and `data_table` renderers exist, but they still need prompt/tool-side structured payload emission before they will appear automatically in normal conversations.

### Memory Lifecycle

Long-term memory now has three write paths and one hybrid read path:

1. Explicit save:
   `save_memory` validates a durable fact, allows up to 500 characters of content, generates an embedding when `OPENAI_API_KEY` is available, and upserts the row into `user_memories`.
2. Pre-compaction flush:
   `maybeCompactConversation()` extracts durable facts from the soon-to-be-compacted transcript before that context is replaced by a summary, then upserts the extracted memories directly.
3. Post-turn extraction:
   after `processMessage()` finishes the user-visible response, `extractMemoriesFromTurn()` runs fire-and-forget on the latest user/assistant turn to catch durable facts the agent did not explicitly save.
4. Hybrid recall:
   `recall_memory` first tries semantic search through the `match_user_memories` Postgres function using pgvector embeddings, then falls back to `ILIKE` matching across both `topic` and `content`.

Design properties:
- automatic memory capture is best-effort and silent on failure so the user-facing response path stays resilient
- embeddings are optional; if embedding generation fails or `OPENAI_API_KEY` is missing, memory save/flush/extraction still persist text memories
- compaction summaries remain in `messages`, while durable facts live separately in `user_memories`

### `agentLoop()`

`src/lib/chat/agent-loop.ts` is the core execution engine.

Current runtime behaviors:
- calls the selected LLM with the available tool schema
- executes tool calls sequentially
- refreshes an idle-progress timer whenever real work advances
- emits enriched events:
  - `text_delta`
  - `thinking`
  - `tool_call`
  - `tool_result`
  - `plan_created`
  - `step_started`
  - `step_completed`
  - `step_failed`
  - `delegation_started`
  - `delegation_completed`
  - `done`
  - `error`
- supports hard timeout and idle timeout handling
- supports per-loop error limits
- supports per-loop iteration limits for delegated agents

Current timeout policy:
- normal interactive runs use a longer base budget with a separate idle timeout
- long-form requests such as research/memo work receive a larger hard runtime budget
- delegated specialist agents have their own profile-specific timeout budgets
- active work is allowed to continue; stalled work is what times out quickly

Current request/runtime split:
- `/api/chat` stays within the Vercel Hobby `300s` serverless limit
- normal interactive runs use direct SSE execution
- long-form runs are queued via `background_jobs` and processed outside the originating chat request

## Orchestration Layers

### Tool Registry

Tools are no longer hardcoded as a plain list. `src/lib/chat/tools/tool-registry.ts` registers manifests and factories, and exposes:
- available tool instances for runtime execution
- manifests for `/api/tools`
- category/risk metadata for UI/control-plane usage

Recent additions:
- `create_document`: Creates a new doc in the `/docs` workspace.
- `update_document`: Modifies an existing doc.
- `mcp_call`: A bridge tool that forwards requests to Model Context Protocol (MCP) servers via JSON-RPC.

Memory-related tools currently split responsibilities this way:
- `save_memory` writes durable facts/preferences into `user_memories`
- `recall_memory` exposes hybrid semantic + fuzzy retrieval over `user_memories`

Rich-output support currently splits responsibilities this way:
- `card-extraction` turns supported tool results into typed `metadata.cards`
- chat card components in `src/components/chat/` render those payloads inline

### Personas

`src/lib/chat/personas.ts` defines pre-built communication style profiles:
- `Balanced` (default) — the standard Hada experience, no modifier applied
- `Concise` — minimal words, bullet points, no filler
- `Friendly` — warm, conversational, casual
- `Professional` — formal, structured, business-ready
- `Academic` — thorough, precise, cites reasoning

The selected persona ID and optional custom instructions are stored in `users.settings` as `persona` and `custom_instructions`. `buildSystemPrompt()` reads these at request time and injects a `## Persona` section and a `## Custom Instructions` section into the prompt when non-default values are set. The persona applies uniformly across web, Telegram, and scheduled runs.

### Planning

`plan_task` creates an ephemeral `TaskPlan` in the active loop:
- plan data is kept in runtime/UI state rather than a database table
- the agent loop tracks the active plan and step progress
- the web chat renders this as an inline task-plan card

### Delegation

`delegate_task` runs nested specialist agents:
- `researcher`
- `memory_manager`
- `scheduler`

**Proactive Scheduler (Time Defense)**:
The `scheduler` agent is configured with "Time Defense" instructions. It doesn't just manage events; it actively identifies schedule gaps for deep work and preemptively identifies conflicts.

Each delegated run:
- builds a focused system prompt
- filters the allowed tool set
- runs a nested `agentLoop()`
- applies profile-specific hard and idle timeout budgets
- forwards child events tagged with `agentName`
- returns the delegated result to the parent agent

## UI Architecture

### Chat

`/chat` is the primary assistant surface.

Key UI elements:
- streaming markdown message content
- **Hada Canvas**: Side-by-side artifact panel for document co-authoring
- `AgentTraceTimeline` for tool/reasoning execution
- `TaskPlanCard` for plan progress
- nested delegation trace groups for sub-agent work
- background-job progress replay for queued long-form runs
- responsive chat layout that keeps long links/code/tables viewable on narrow viewports

### Dashboard

`/dashboard` is the control plane for activity, tools, and scheduled tasks.

### Docs Workspace

`/docs` is the primary library for user documents.
- Obsidian-style markdown editor (Tiptap-powered).
- Two-pane layout with folder navigation.
- Agent-readable: Documents act as RAG context when referenced or attached in chat.

### Settings

`/settings` is the user configuration surface.

Current sections:
- runtime/provider status
- integrations management
- account preferences, persona selection, custom instructions, and conversation reset
- memory management backed by the same `user_memories` table used by the agent loop
- mobile layout uses a compact section switcher so the active pane is visible immediately

## Data Model

Primary persisted entities:
- `users`
- `conversations`
- `messages`
- `integrations`
- `user_memories`
- `scheduled_tasks`
- `documents`                (Title, content, folder, user_id)
- `telegram_link_tokens`
- `agent_runs`
- `background_jobs`
- `background_job_events`

Important non-persisted orchestration state:
- active task plans
- current step progress
- delegated sub-agent event grouping
- per-run timeout/idle budget selection

Memory-specific persisted data:
- `messages` stores raw chat history plus compaction summaries (`metadata.type = "compaction"`)
- `user_memories` stores topic-keyed durable memories with optional pgvector embeddings
- `match_user_memories(...)` is a database function used by semantic recall

Rich-output persisted data:
- assistant `messages.metadata.cards` stores typed rich-card payloads for inline UI rendering

## MCP Integration

Hada supports the Model Context Protocol (MCP) via a dedicated `mcp_call` tool. 
- **Bridge Pattern**: The agent acts as an MCP client, calling out to local or remote MCP servers.
- **Dynamic Capabilities**: This allows Hada to gain new tools (filesystem access, GitHub, database queries) without changes to the core codebase.

## Security Model

### Authentication

- Supabase Auth handles sign-in/session management
- server/client middleware refreshes sessions
- protected routes include `/chat`, `/dashboard`, and `/settings`

### Authorization

RLS protects user-owned tables by `auth.uid() = user_id` semantics.

Service-role access is used for:
- Telegram/webhook flows
- internal cron-driven work
- server-side flows that need to bypass end-user RLS safely

### External Integrations

- Google integration uses OAuth tokens stored in `integrations`
- Telegram linking uses short-lived `telegram_link_tokens`
- web search uses provider-specific API keys from env

## Provider Architecture

LLM providers are resolved through `src/lib/chat/providers.ts`.

Supported providers:
- MiniMax
- OpenAI
- Anthropic
- Gemini
- Kimi
- DeepSeek
- Groq

Most providers use an OpenAI-compatible request shape; Anthropic uses a native path.

## Observability

There are two observability layers:

1. Live UI trace:
- SSE events stream directly into chat
- users can inspect reasoning/tool activity inline

2. Persisted run telemetry:
- `agent_runs` records per-run status, duration, previews, tool calls, and errors
- dashboard analytics aggregate this for recent activity and tool usage
- timed-out runs distinguish between runtime failure and explicit timeout conditions via final run status/error text
3. Persisted background-job events:
- `background_jobs` tracks queued long-form work
- `background_job_events` stores pollable progress events for replay into chat

## Scaling Notes

- The app is largely stateless between requests; durable state lives in Postgres.
- Context compaction keeps prompt size bounded over time.
- Telemetry and dashboard queries are indexed by user and time.
- Delegation currently runs sequentially inside a parent tool call; it does not fan out sub-agents in parallel inside the app runtime.
- Long-running research-style work now uses a background-job path; truly short interactive work still runs inline inside the request.
