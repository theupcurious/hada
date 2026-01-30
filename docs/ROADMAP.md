# Product Roadmap

## Vision

Hada is "Bot as a Service" (BaaS) - anyone can sign up and get their own AI assistant that actually does things. Like having a brilliant executive assistant available 24/7.

## Pricing

| Tier | Price | Target User |
|------|-------|-------------|
| Free | $0/month | Trying it out |
| Paid | $20/month | Regular users |
| Pro | $50/month | Power users, businesses |

---

## Phase 1: Foundation ✅

**Status:** Complete

**Goal:** Basic app infrastructure with auth and UI

### Deliverables

- [x] Next.js 16 project with TypeScript
- [x] Tailwind CSS + shadcn/ui components
- [x] Supabase authentication (email + Google OAuth)
- [x] Database schema with RLS
- [x] Landing page with hero and features
- [x] Login/signup pages
- [x] Basic chat UI
- [x] Railway deployment config

### Key Files

- `src/app/page.tsx` - Landing page
- `src/app/chat/page.tsx` - Chat interface
- `src/app/auth/*` - Authentication pages
- `supabase/migrations/001_initial_schema.sql` - Database schema

---

## Phase 2: Moltbot Integration

**Status:** In Progress

**Goal:** Connect the UI to moltbot for actual AI capabilities

### Tasks

- [x] Create Dockerfile for moltbot
  - Base image with Node 22+
  - Configure for headless server operation
  - Set up environment variables
- [ ] Deploy moltbot container to Railway
- [x] Build WebSocket bridge service
  - Proxy WebSocket from Next.js to moltbot Gateway
  - Handle authentication mapping
- [x] Implement user session isolation
  - Namespace conversations by user ID (sessionKey = userId)
  - Store context per user (moltbot handles context, DB for display)
- [x] Conversation persistence
  - Messages stored to Supabase
  - Load last 25 messages on page load
  - Lazy load older messages on scroll
- [ ] Add health monitoring
  - Instance health checks
  - Auto-restart on failure

### Architecture

```
Next.js App ──WebSocket──▶ Bridge Service ──WebSocket──▶ Moltbot Gateway
     │                           │
     │                           ▼
     │                    Session Router
     │                    (user → instance)
     ▼
  Supabase
(conversations, messages)
```

### Success Criteria

- Users can chat with moltbot through Hada UI
- Messages persist to database
- Sessions survive page refresh

---

## Phase 3: Core Integrations

**Status:** Not Started

**Goal:** Calendar and email integration for real assistant value

### Tasks

- [ ] Google OAuth with Calendar + Gmail scopes
- [ ] Microsoft OAuth for Outlook users (optional)
- [ ] Calendar integration
  - Fetch and display events
  - Create new events
  - Modify/delete events
  - Check availability
- [ ] Email integration
  - Fetch recent emails
  - Draft responses
  - Send emails
  - Summarize threads
- [ ] Rich message cards in chat
  - Calendar event cards
  - Email preview cards
  - Action buttons
- [ ] Task/reminder system
  - Create and track tasks
  - Schedule reminders
  - Follow-up notifications

### UI Components

```
┌────────────────────────────────────────┐
│ 📅 Meeting: Team Standup               │
│ Tomorrow, 10:00 AM - 10:30 AM          │
│ [Join Meeting] [Reschedule] [Cancel]   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📧 From: John Smith                    │
│ Subject: Q4 Planning                   │
│ "Hi, can we schedule a call to..."     │
│ [Reply] [Archive] [Forward]            │
└────────────────────────────────────────┘
```

### Success Criteria

- Users can view/create calendar events through chat
- Users can read/send emails through chat
- Actions happen with one tap (not confirmation dialogs)

---

## Phase 4: Polish

**Status:** Not Started

**Goal:** Beta-ready product with excellent UX

### Tasks

- [ ] Onboarding flow
  - Welcome screen
  - OAuth connection prompts
  - Sample conversation starter
  - Tips for first-time users
- [ ] Morning briefing
  - Scheduled daily summary (configurable time)
  - Today's calendar overview
  - Important emails
  - Pending tasks
  - Weather (optional)
- [ ] Mobile-responsive design
  - Touch-friendly interactions
  - Bottom navigation on mobile
  - Swipe gestures
- [ ] Error handling UX
  - Graceful failure messages
  - Retry mechanisms
  - Offline indicators
  - Connection status
- [ ] Usage tracking (internal)
  - API cost per user
  - Message volume
  - Feature usage analytics

### Success Criteria

- 10 beta users actively using for 2+ weeks
- Average 5+ conversations per user per week
- <1% error rate on core actions

---

## Phase 5: Monetization

**Status:** Not Started

**Goal:** Revenue generation with Stripe

### Tasks

- [ ] Stripe integration
  - Products: Free, Paid ($20), Pro ($50)
  - Checkout flow
  - Customer portal
  - Webhooks for subscription events
- [ ] Tier-based access control
  - Feature gating by tier
  - Usage limits
  - Upgrade prompts
- [ ] Usage metering
  - Track LLM API usage per user
  - Soft limits (warning)
  - Hard limits (block)
- [ ] Billing dashboard
  - Current plan display
  - Usage visualization
  - Invoice history
  - Payment method management

### Pricing Features

| Feature | Free | Paid | Pro |
|---------|------|------|-----|
| Messages/day | 20 | Unlimited | Unlimited |
| Calendar | View only | Full access | Full access |
| Email | Read only | Full access | Full access |
| Instance | Shared | Shared | Dedicated |
| Support | Community | Email | Priority |

### Success Criteria

- Payment flow works end-to-end
- Users can upgrade/downgrade
- Usage limits enforced correctly

---

## Phase 6: Scale

**Status:** Not Started

**Goal:** Support growth and premium features

### Tasks

- [ ] Multi-instance orchestration
  - Spin up dedicated instances for Pro
  - Instance pooling for shared tiers
  - Auto-scaling based on demand
  - Graceful instance shutdown
- [ ] Mobile apps (React Native)
  - iOS app
  - Android app
  - Push notifications
  - Biometric auth
- [ ] Voice input
  - Web Speech API
  - Mobile native speech
  - Voice commands
- [ ] Messaging integrations
  - WhatsApp Business API
  - Telegram Bot API
  - Slack workspace app

### Success Criteria

- Pro users get dedicated instances
- Mobile apps in app stores
- At least one messaging platform integrated

---

## Phase 7: Skills Platform

**Status:** Not Started

**Goal:** Extensible capabilities beyond core features

### Tasks

- [ ] Skills architecture
  - Define skill interface (triggers, actions, permissions)
  - Skill registry and discovery
  - Sandboxed execution environment
  - Skill state management
- [ ] Operator skill builder
  - Admin UI for creating skills
  - Skill templates
  - Testing sandbox
- [ ] User integrations
  - "Connect your apps" UI
  - OAuth flows for third-party services
  - Custom API connections (Zapier-like)
- [ ] Marketplace foundation
  - Developer documentation
  - Skill submission process
  - Review and approval workflow
  - Revenue sharing model

### Example Skills

| Skill | Capability |
|-------|------------|
| Tax Prep | Connect to tax software, gather documents, file |
| Travel | Search flights/hotels, book with approval |
| Expenses | Scan receipts, categorize, submit reports |
| Shopping | Research products, compare prices, order |
| Health | Book appointments, medication reminders |
| Social | Draft posts, schedule, respond to comments |

### Success Criteria

- At least 5 operator-built skills live
- Users can connect third-party apps
- Developer documentation complete

---

## Success Metrics

### Technical

- App loads in <2 seconds
- Message response in <3 seconds
- 99.9% uptime

### Business

- 100 paying users within 6 months
- $2,000 MRR within 6 months
- <5% monthly churn

### User

- 4.5+ star rating
- 50% weekly active users
- Net Promoter Score >40
