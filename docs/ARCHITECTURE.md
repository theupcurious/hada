# Architecture

## Overview

Hada is a multi-tenant SaaS that provides AI assistant capabilities with a built-in agent loop. The architecture prioritizes:

1. **Simplicity** - Self-contained, no external AI gateway dependency
2. **Multi-channel** - Same assistant accessible via web and Telegram
3. **Cost efficiency** - Universal LLM provider support, choose the best value
4. **Security** - User data isolation via Row Level Security

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Users                                   │
│              (Web Browser / Telegram / Mobile App)                   │
└────────────────┬──────────────────────────┬─────────────────────────┘
                 │                          │
                 ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Railway Platform                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      Next.js Application                        │ │
│  │                                                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │   Frontend   │  │  API Routes  │  │     Middleware       │  │ │
│  │  │  (React 19)  │  │  (REST)      │  │  (Auth, Sessions)    │  │ │
│  │  └──────────────┘  └──────┬───────┘  └──────────────────────┘  │ │
│  │                           │                                      │ │
│  │                    ┌──────┴───────┐                              │ │
│  │                    │  Shared Chat │                              │ │
│  │                    │  Processing  │                              │ │
│  │                    └──────┬───────┘                              │ │
│  │                           │                                      │ │
│  │  ┌────────────────────────┼────────────────────────────────┐    │ │
│  │  │              Agent Loop Engine                           │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │ │
│  │  │  │ System Prompt │  │  Tool Exec   │  │   Context    │  │    │ │
│  │  │  │  Assembly     │  │  (Sequential)│  │   Manager    │  │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  │    │ │
│  │  └────────────────────────┬────────────────────────────────┘    │ │
│  │                           │                                      │ │
│  │  ┌────────────────────────┼────────────────────────────────┐    │ │
│  │  │                   Agent Tools                            │    │ │
│  │  │  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌────────┐  │    │ │
│  │  │  │Calendar│ │ Memory │ │Search│ │  Fetch │ │Schedule│  │    │ │
│  │  │  └────────┘ └────────┘ └──────┘ └────────┘ └────────┘  │    │ │
│  │  └────────────────────────────────────────────────────────┘    │ │
│  │                                                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                           │                                          │
│              ┌────────────┼────────────┐                            │
│              ▼            ▼            ▼                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL  │  │   Telegram   │  │  Cron Jobs   │              │
│  │  (Supabase)  │  │  Bot API     │  │  (Scheduled) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       External Services                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │    Stripe    │  │ Google APIs  │  │      LLM Providers       │  │
│  │  (Billing)   │  │ (Cal/Email)  │  │ MiniMax, Anthropic,      │  │
│  │              │  │              │  │ OpenAI, Gemini, Kimi,    │  │
│  │              │  │              │  │ DeepSeek, Groq           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Authentication Flow

```
User → Login Page → Supabase Auth → Session Cookie → Middleware validates → Protected Routes
```

1. User enters credentials or clicks OAuth
2. Supabase handles authentication
3. Session stored in secure HTTP-only cookie
4. Middleware refreshes session on each request
5. Protected routes check for valid session

### Chat Message Flow (Web)

```
User Input → /api/chat → processMessage() → Agent Loop → LLM Provider → Response → UI Update
```

1. User types message in chat UI
2. Message sent to Next.js API route
3. `processMessage()` builds system prompt, assembles context
4. Agent loop calls LLM with tools
5. If LLM returns tool calls → execute sequentially → re-call LLM
6. Loop until natural completion, timeout, or error limit
7. Response saved to database and returned to UI

### Chat Message Flow (Telegram)

```
User Message → Telegram API → /api/webhooks/telegram → processMessage() → Agent Loop → LLM → editMessageText
```

1. User sends message via Telegram
2. Telegram delivers to webhook endpoint
3. Webhook looks up user via `telegram_chat_id` in integrations
4. Runs agent loop with streaming
5. Sends initial message, then edits in-place as response streams (~1 edit/sec)
6. Message saved to shared conversation

### Agent Loop Flow

```
┌─────────────────────────────────────────────┐
│              Agent Loop                      │
│                                              │
│  ┌──────────┐    ┌─────────────┐            │
│  │ Call LLM │───▶│ Stream text │──┐         │
│  │ w/ tools │    │   deltas    │  │         │
│  └──────────┘    └─────────────┘  │         │
│       ▲                           ▼         │
│       │              ┌──────────────────┐   │
│       │              │ Tool calls in    │   │
│       │              │ response?        │   │
│       │              └────┬────────┬────┘   │
│       │                   │ Yes    │ No     │
│       │                   ▼        ▼        │
│       │          ┌──────────┐  ┌───────┐   │
│       └──────────│ Execute  │  │ Done  │   │
│                  │ tools    │  └───────┘   │
│                  └──────────┘              │
│                                              │
│  Stop conditions:                            │
│  - No tool calls (natural completion)        │
│  - Timeout (default 60s)                     │
│  - 3 consecutive tool errors                 │
└─────────────────────────────────────────────┘
```

### System Prompt Assembly

```
┌────────────────────────────────┐
│         System Prompt          │
├────────────────────────────────┤
│ 1. Base Persona (system.md)    │
│    - Identity, personality     │
│    - Tool usage conventions    │
│    - Memory management rules   │
├────────────────────────────────┤
│ 2. User Context (from DB)     │
│    - Name, tier, timezone      │
│    - Connected integrations    │
├────────────────────────────────┤
│ 3. Memories (~2000 tokens max) │
│    - Topic-keyed memories      │
│    - Most recently updated     │
├────────────────────────────────┤
│ 4. Channel Context            │
│    - "via web" or "via Telegram"│
└────────────────────────────────┘
```

### Data Storage

```
User Data ──────────────────────────────────────────────────────────┐
    │                                                                │
    ▼                                                                ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐
│    Users     │    │ Conversations│    │       Integrations           │
│  (profiles,  │───▶│  (threads)   │    │  (Google, Telegram, etc.)    │
│   settings)  │    └──────┬───────┘    └──────────────────────────────┘
└──────┬───────┘           │
       │                   ▼
       │            ┌──────────────┐
       │            │   Messages   │
       │            │ (web+telegram│
       │            │  unified)    │
       │            └──────────────┘
       │
       ├───────────▶┌──────────────┐
       │            │ User Memories│
       │            │ (topic-keyed)│
       │            └──────────────┘
       │
       └───────────▶┌──────────────────┐
                    │ Scheduled Tasks  │
                    │ (once/recurring) │
                    └──────────────────┘
```

## Security Model

### Row Level Security (RLS)

Every table has RLS policies ensuring users can only access their own data:

```sql
-- Example: Users can only view their own conversations
create policy "Users can view own conversations" on public.conversations
  for select using (auth.uid() = user_id);
```

### Authentication

- Supabase Auth handles all authentication
- JWT tokens with short expiry
- Secure HTTP-only cookies for sessions
- Middleware refreshes sessions automatically

### Webhook Security

- Telegram webhook verified via secret token header
- Cron routes protected with internal auth
- Admin client used for webhook-initiated DB operations (bypasses RLS with service role)

### Data Encryption

- All data encrypted at rest (Supabase default)
- TLS for all connections
- OAuth tokens stored encrypted in integrations table

## Multi-Channel Architecture

### Unified Conversation Model

All channels (web, Telegram, scheduled tasks) share a single conversation per user:

- Messages tagged with `source` in metadata: `"web"`, `"telegram"`, `"scheduled"`
- Same agent context regardless of channel
- Start a thought on Telegram, continue on web

### Channel-Specific Adapters

| Channel | Input | Output | Streaming |
|---------|-------|--------|-----------|
| Web | HTTP POST | JSON response | Future: SSE |
| Telegram | Webhook POST | Bot API `sendMessage` / `editMessageText` | Live message editing |
| Scheduled | Cron trigger | Telegram + DB save | N/A |

## LLM Provider Architecture

### Universal Client

Most providers support OpenAI-compatible APIs. A single provider registry maps provider names to base URLs and default models:

```
Request → Provider Registry → OpenAI SDK (with baseURL) → Provider API
                                    └── Anthropic SDK (native) ──→ Anthropic API
```

- Users select provider + model in settings
- API keys configured per-provider via env vars
- Adding a new provider = one line in the registry

### Supported Providers

| Provider | API Format | Default Model |
|----------|-----------|---------------|
| MiniMax | OpenAI-compatible | MiniMax-M2.1 |
| OpenAI | Native | gpt-4o |
| Anthropic | Native SDK | claude-sonnet-4-5 |
| Gemini | OpenAI-compatible | gemini-2.5-flash |
| Kimi | OpenAI-compatible | moonshot-v1-auto |
| DeepSeek | OpenAI-compatible | deepseek-chat |
| Groq | OpenAI-compatible | llama-3.3-70b |

## Scalability Considerations

### Horizontal Scaling

- Next.js app scales automatically on Railway
- Stateless request handling (all state in Postgres)
- No external gateway service to manage

### Database Scaling

- Supabase handles PostgreSQL scaling
- Connection pooling via Supabase
- Read replicas available if needed

### Cost Optimization

- Track LLM usage per user for metering
- Use cheaper models for simple tasks
- Memory compaction reduces token usage over time
- Context sliding window prevents unbounded costs
