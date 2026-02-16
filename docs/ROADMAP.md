# Product Roadmap

## Snapshot (February 16, 2026)

Hada has moved from an OpenClaw-based gateway architecture to a built-in agent runtime.
Core web chat, Telegram channel support, long-term memory, web tools, and scheduled task execution are now in place.

## Vision

Hada is "Bot as a Service" (BaaS): each user gets an assistant that can reason, use tools, remember context, and act across channels.

---

## Completed Milestones

### Phase 1: Foundation ✅
- Next.js 16 app with TypeScript and Tailwind v4
- Supabase auth and base schema with RLS
- Web chat UI and settings experience

### Phase 2: AI Chat ✅
- Conversation persistence and message history
- Health/status endpoints and polling
- Initial provider integration and tool-enabled chat flows

### Phase 3: Agent Loop & Core Runtime ✅
- Built-in async agent loop with tool execution
- Multi-provider registry (MiniMax, Anthropic, OpenAI, Gemini, Kimi, DeepSeek, Groq)
- Layered system prompt assembly
- Sliding window + conversation compaction support
- Shared `processMessage()` pipeline used across channels
- OpenClaw dependency removed

### Phase 4: Telegram Integration ✅
- Telegram webhook route and bot API wrapper
- Account linking via short-lived deep-link tokens
- Inbound message handling and live response editing
- MarkdownV2 formatting utilities
- Telegram connect flow in Settings

### Phase 5: Web Tools & Scheduling (MVP) ✅
- `web_search` tool (provider-based: tavily/serpapi/brave)
- `web_fetch` tool
- `schedule_task` tool
- Cron execution route for due tasks
- Scheduled delivery support to Telegram

---

## Active Priorities

### Phase 6: Reliability & UX Polish (In Progress)
- Improve response formatting normalization across providers
- Tighten tool-call protocol sanitization and fallback parsing
- Harden error surfacing and recovery in agent loop
- Add richer UI rendering for structured outputs
- Improve onboarding and integration setup guidance

### Phase 7: Google/Microsoft Integrations (In Progress)
- Expand calendar capabilities (availability and richer edits)
- Gmail read/send workflows
- Microsoft OAuth and Outlook parity

---

## Next Milestones

### Phase 8: Monetization
- Stripe checkout and customer portal
- Tier-based limits and feature gating
- Usage metering and billing visibility

### Phase 9: Scale
- Mobile app surfaces
- Additional channels (WhatsApp, Slack)
- Operational dashboards and alerting

### Phase 10: Skills Platform
- Skill interface and registry
- Sandboxed skill execution model
- Developer-facing docs and examples

---

## Success Metrics

### Technical
- Median response latency < 3s for non-tool turns
- Stable tool execution with low failure rate
- Long-running conversations remain within context budget

### Product
- Multi-week retention for active users
- Strong weekly usage across web + Telegram
- High reliability for scheduled and integration-driven actions
