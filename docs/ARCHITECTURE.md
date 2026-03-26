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
  │   ├─ /api/chat              (SSE stream)
  │   ├─ /api/tools
  │   ├─ /api/dashboard/*
  │   ├─ /api/webhooks/telegram
  │   └─ /api/cron
  ├─ Shared orchestration
  │   ├─ processMessage()
  │   ├─ agentLoop()
  │   ├─ buildSystemPrompt()
  │   └─ context-manager
  ├─ Tool registry
  │   ├─ memory tools
  │   ├─ web tools
  │   ├─ calendar tools
  │   ├─ planning tool
  │   └─ delegation tool
  └─ Sub-agent profiles
      ├─ researcher
      ├─ memory_manager
      └─ scheduler

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
  → long-lived request budget (`maxDuration = 600`)
  → processMessage()
  → run budget selection (normal vs long-form research)
  → agentLoop()
  → LLM + tools
  → SSE events (text, tool, plan, delegation)
  → UI updates inline
  → final response + telemetry persisted
```

Key properties:
- `/api/chat` returns an SSE stream, not a single JSON blob.
- The frontend updates assistant text, trace cards, task plans, and delegated sub-agent groups in real time.
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
  → processMessage(source="scheduled")
  → shared conversation + downstream delivery
```

## Core Runtime

### `processMessage()`

`src/lib/chat/process-message.ts` is the orchestration entry point. It is responsible for:
- creating/finding the user conversation
- saving the user message
- resolving integrations and tool availability
- building the system prompt
- selecting the provider/model
- selecting runtime budgets based on the request shape
- running `agentLoop()`
- persisting the assistant response
- recording `agent_runs` telemetry

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

## Orchestration Layers

### Tool Registry

Tools are no longer hardcoded as a plain list. `src/lib/chat/tools/tool-registry.ts` registers manifests and factories, and exposes:
- available tool instances for runtime execution
- manifests for `/api/tools`
- category/risk metadata for UI/control-plane usage

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
- `AgentTraceTimeline` for tool/reasoning execution
- `TaskPlanCard` for plan progress
- nested delegation trace groups for sub-agent work
- responsive chat layout that keeps long links/code/tables viewable on narrow viewports

### Dashboard

`/dashboard` is the control plane.

Current sections:
- activity feed from `agent_runs`
- tool analytics from `agent_runs.tool_calls`
- memory browser/editor backed by `user_memories`
- task manager backed by `scheduled_tasks`

### Settings

`/settings` is the user configuration surface.

Current sections:
- runtime/provider status
- integrations management
- account preferences and conversation reset
- memory management backed by the same `user_memories` table used by the agent loop

## Data Model

Primary persisted entities:
- `users`
- `conversations`
- `messages`
- `integrations`
- `user_memories`
- `scheduled_tasks`
- `telegram_link_tokens`
- `agent_runs`

Important non-persisted orchestration state:
- active task plans
- current step progress
- delegated sub-agent event grouping
- per-run timeout/idle budget selection

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

## Scaling Notes

- The app is largely stateless between requests; durable state lives in Postgres.
- Context compaction keeps prompt size bounded over time.
- Telemetry and dashboard queries are indexed by user and time.
- Delegation currently runs sequentially inside a parent tool call; it does not fan out sub-agents in parallel inside the app runtime.
- Long-running work still executes inside the request path today; timeout budgets are intentionally generous for research-style tasks, but the architecture can later move these into a background job model if needed.
