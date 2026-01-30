# Phase 3: Google Calendar & Gmail Integration Design

**Date:** 2026-01-30
**Status:** Approved
**Owner:** Product

## Overview

Phase 3 adds Google Calendar and Gmail integration to Hada, enabling users to manage their schedule and email through natural conversation. The AI assistant can read calendars, create events, check emails, and send messages on behalf of users.

## Design Decisions

### Scope
- **Google only** (not Microsoft) - focus on one provider, iterate quickly
- **Rich interactive cards** - structured UI components with action buttons
- **Hybrid permissions** - reads are direct, writes require confirmation (configurable)
- **MCP tools via Next.js API routes** - secure token management, easy authorization
- **Session-based authentication** - reuse existing userId/sessionKey pattern

## Architecture

### Component Flow

```
User Chat
    ↓ (WebSocket)
OpenClaw Gateway
    ↓ (AI detects need for calendar/email)
    ↓ (calls MCP tool)
Next.js API Routes (/api/tools/*)
    ↓ (retrieves OAuth tokens from Supabase)
    ↓ (checks user permissions)
Google Calendar/Gmail APIs
    ↓ (returns data)
Next.js formats as rich card
    ↓ (returns structured response)
OpenClaw includes card in message
    ↓ (WebSocket)
User sees rich card with action buttons
```

### Key Components

1. **OAuth Flow**: User connects Google account in Settings
2. **Token Management**: Secure storage in Supabase with auto-refresh
3. **MCP Tools**: OpenClaw calls Next.js endpoints as tools
4. **Permission Layer**: Configurable action permissions (direct vs confirm)
5. **Rich Cards**: Calendar events and emails render as interactive components

## OAuth Implementation

### Google OAuth Setup

**Required Scopes:**
- `https://www.googleapis.com/auth/calendar` - Full calendar access
- `https://www.googleapis.com/auth/gmail.modify` - Read/send/delete emails (not permanent)

### Authorization Flow

1. **Connect Button**: Settings → Integrations → Google → "Connect"
2. **Authorization** (`/api/auth/google/authorize`):
   - Generate state token (CSRF protection)
   - Redirect to Google OAuth consent screen
   - Redirect URI: `https://yourdomain.com/api/auth/google/callback`
3. **Callback** (`/api/auth/google/callback`):
   - Validate state token
   - Exchange code for access_token + refresh_token
   - Store in `integrations` table with `expires_at`
   - Redirect to Settings with success message
4. **Token Refresh** (`src/lib/google/tokens.ts`):
   - Check expiry before each API call
   - Use refresh_token to get new access_token
   - Update `integrations` table
   - Handle revocation gracefully (mark disconnected)
5. **Disconnect**: Delete from `integrations` table

### Database Changes

No new tables needed - `integrations` table already supports this:

```sql
-- Already exists in 001_initial_schema.sql
create table public.integrations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp with time zone not null,
  scopes text[] not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, provider)
);
```

Add `permissions` column to `users` table:

```sql
-- New migration: 002_add_user_permissions.sql
alter table public.users
  add column permissions jsonb default '{
    "google_calendar_read": "direct",
    "google_calendar_write": "confirm",
    "google_gmail_read": "direct",
    "google_gmail_send": "confirm"
  }'::jsonb;
```

## MCP Tools & API Routes

### Tool Structure

Each MCP tool is a Next.js API route following this pattern:

```typescript
// Tool definition for OpenClaw
{
  name: "create_calendar_event",
  description: "Create a new calendar event",
  parameters: {
    summary: string,      // Event title
    start: string,        // ISO 8601 datetime
    end: string,          // ISO 8601 datetime
    description?: string,
    attendees?: string[], // Email addresses
    location?: string
  }
}
```

### Calendar Tools

- **`list_calendar_events`** - Get events in date range
  - Parameters: `start_date`, `end_date`, `calendar_id?` (default: primary)
  - Returns: Array of event objects

- **`create_calendar_event`** - Create new event
  - Parameters: `summary`, `start`, `end`, `description?`, `attendees?`, `location?`
  - Returns: Created event object

- **`update_calendar_event`** - Modify existing event
  - Parameters: `event_id`, fields to update
  - Returns: Updated event object

- **`delete_calendar_event`** - Cancel/delete event
  - Parameters: `event_id`
  - Returns: Success confirmation

- **`check_availability`** - Find free time slots
  - Parameters: `start_date`, `end_date`, `duration_minutes`, `attendees?`
  - Returns: Array of available time slots

### Gmail Tools

- **`list_emails`** - Get recent emails
  - Parameters: `query?`, `max_results?`, `label_ids?`
  - Returns: Array of email summaries

- **`get_email`** - Get full email by ID
  - Parameters: `email_id`
  - Returns: Full email object with body

- **`send_email`** - Send new email
  - Parameters: `to`, `subject`, `body`, `cc?`, `bcc?`
  - Returns: Sent message object

- **`reply_to_email`** - Reply to existing thread
  - Parameters: `email_id`, `body`
  - Returns: Sent reply object

- **`search_emails`** - Search by query
  - Parameters: `query` (Gmail search syntax)
  - Returns: Array of matching emails

### API Route Pattern

Each tool endpoint follows this flow:

```typescript
// /api/tools/calendar/create-event/route.ts
export async function POST(request: Request) {
  // 1. Authenticate request (from OpenClaw with proper token)
  const { userId, params } = await authenticateToolRequest(request);

  // 2. Retrieve user's OAuth tokens from Supabase
  const tokens = await getGoogleTokens(userId);

  // 3. Check user's permission settings
  const permission = await checkPermission(userId, 'google_calendar_write');
  if (permission === 'confirm') {
    return confirmationRequired(params);
  }

  // 4. Refresh token if needed
  const validToken = await ensureValidToken(tokens);

  // 5. Call Google API
  const event = await createCalendarEvent(validToken, params);

  // 6. Return structured response with card metadata
  return Response.json({
    success: true,
    data: event,
    card: {
      type: 'calendar_event',
      data: event,
      actions: ['reschedule', 'cancel', 'join']
    }
  });
}
```

### Permission System

User permissions stored in `users.permissions` jsonb column:

```json
{
  "google_calendar_read": "direct",     // Execute immediately
  "google_calendar_write": "confirm",   // Ask for confirmation
  "google_gmail_read": "direct",
  "google_gmail_send": "confirm"
}
```

**Default:** Reads are "direct", writes are "confirm"

Tools check permissions before executing:
- **direct**: Execute action, return result
- **confirm**: Return ConfirmationCard, wait for user approval

## UI Components

### Message Types & Metadata

Chat messages can have different types via `metadata.type`:

```typescript
// In messages.metadata jsonb column
{
  type: "calendar_event" | "email" | "confirmation" | "text",
  data: {
    // Type-specific data
  },
  actions: string[] // Available actions for this card
}
```

### New Components

**1. CalendarEventCard** (`src/components/chat/calendar-event-card.tsx`)

```tsx
interface CalendarEventCardProps {
  event: {
    id: string;
    summary: string;
    start: string;
    end: string;
    attendees?: string[];
    location?: string;
    meetingLink?: string;
  };
  actions: string[]; // e.g., ['reschedule', 'cancel', 'join']
}
```

Features:
- Shows event details with 📅 icon
- Formats times in user's timezone
- Action buttons: "Reschedule", "Cancel", "Join Meeting"
- Clicking buttons triggers API calls with optimistic updates

**2. EmailCard** (`src/components/chat/email-card.tsx`)

```tsx
interface EmailCardProps {
  email: {
    id: string;
    from: string;
    subject: string;
    snippet: string;
    timestamp: string;
    unread: boolean;
  };
  actions: string[]; // e.g., ['reply', 'archive', 'mark_read']
}
```

Features:
- Shows 📧 icon, sender, subject, preview
- Action buttons: "Reply", "Archive", "Mark Read"
- Expandable to show full email body
- Reply opens inline compose box

**3. ConfirmationCard** (`src/components/chat/confirmation-card.tsx`)

```tsx
interface ConfirmationCardProps {
  action: string; // e.g., "send_email"
  details: {
    summary: string; // "Send email to john@example.com"
    data: any;       // Full action parameters
  };
  onConfirm: () => void;
  onCancel: () => void;
}
```

Features:
- Shows pending action details
- "Confirm" and "Cancel" buttons
- Used when permission setting is "confirm"
- Optimistic update on confirm

**4. MessageRenderer Updates** (`src/app/chat/page.tsx`)

Update message rendering logic:

```tsx
function renderMessage(message: Message) {
  if (message.metadata?.type === 'calendar_event') {
    return <CalendarEventCard {...message.metadata} />;
  }
  if (message.metadata?.type === 'email') {
    return <EmailCard {...message.metadata} />;
  }
  if (message.metadata?.type === 'confirmation') {
    return <ConfirmationCard {...message.metadata} />;
  }
  // Default: text rendering
  return <div>{message.content}</div>;
}
```

### Settings UI Updates

**Integrations Tab** (`src/components/settings/integrations-tab.tsx`):

1. **Connection Status**
   - Show "Connected" with green checkmark when OAuth active
   - Show last sync time
   - "Disconnect" button when connected

2. **Permissions Section** (new)
   - Grouped by provider and category
   - Toggle switches for each permission:
     - "Calendar - View events" → [Direct / Confirm]
     - "Calendar - Create/edit events" → [Direct / Confirm]
     - "Gmail - Read emails" → [Direct / Confirm]
     - "Gmail - Send emails" → [Direct / Confirm]
   - Help text explaining the difference

## OpenClaw Configuration

### Static Tool Configuration

Add tool definitions to `openclaw/config.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "minimax/MiniMax-M2.1"
      },
      "tools": [
        {
          "type": "http",
          "name": "list_calendar_events",
          "description": "Get the user's calendar events within a date range. Use this when the user asks about their schedule, meetings, or availability.",
          "url": "http://nextjs:3000/api/tools/calendar/list-events",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer ${OPENCLAW_API_TOKEN}",
            "X-Session-Key": "${SESSION_KEY}"
          },
          "parameters": {
            "type": "object",
            "properties": {
              "start_date": {
                "type": "string",
                "description": "Start date in ISO 8601 format (YYYY-MM-DD)"
              },
              "end_date": {
                "type": "string",
                "description": "End date in ISO 8601 format (YYYY-MM-DD)"
              }
            },
            "required": ["start_date", "end_date"]
          }
        },
        {
          "type": "http",
          "name": "create_calendar_event",
          "description": "Create a new calendar event. Use this when the user asks to schedule a meeting, set up an appointment, or add an event to their calendar.",
          "url": "http://nextjs:3000/api/tools/calendar/create-event",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer ${OPENCLAW_API_TOKEN}",
            "X-Session-Key": "${SESSION_KEY}"
          },
          "parameters": {
            "type": "object",
            "properties": {
              "summary": {
                "type": "string",
                "description": "Event title/summary"
              },
              "start": {
                "type": "string",
                "description": "Start datetime in ISO 8601 format"
              },
              "end": {
                "type": "string",
                "description": "End datetime in ISO 8601 format"
              },
              "description": {
                "type": "string",
                "description": "Event description or notes"
              },
              "attendees": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Email addresses of attendees"
              },
              "location": {
                "type": "string",
                "description": "Event location or meeting room"
              }
            },
            "required": ["summary", "start", "end"]
          }
        }
        // ... more tools (update, delete, check_availability, email tools)
      ]
    }
  }
}
```

### User Context Passing

OpenClaw includes `X-Session-Key` header with userId when calling tools.

Tool endpoints extract user context:

```typescript
async function authenticateToolRequest(request: Request) {
  // Verify OPENCLAW_API_TOKEN
  const token = request.headers.get('Authorization');
  if (!isValidOpenClawToken(token)) {
    throw new Error('Unauthorized');
  }

  // Extract userId from session
  const sessionKey = request.headers.get('X-Session-Key');
  const userId = sessionKey; // sessionKey is already userId

  return { userId, params: await request.json() };
}
```

## Error Handling

### Error Scenarios

**1. OAuth Token Issues**
- **Token expired**: Auto-refresh using refresh_token
- **Refresh token invalid**: Show "Reconnect Google" message in chat + notification in Settings
- **Missing scopes**: Prompt re-authorization with additional scopes

**2. Google API Failures**
- **Rate limits**: Queue requests, retry with exponential backoff
- **Network errors**: Show friendly error, allow retry button
- **Resource not found**: Graceful message ("That event no longer exists")

**3. Permission Denied**
- **Needs confirmation**: Return ConfirmationCard
- **Not connected**: Show helpful message with link to Settings

**4. OpenClaw Tool Failures**
- **Tool returns error**: OpenClaw explains to user naturally
- **Timeout**: Show "This is taking longer than expected..." message

### Error Response Pattern

```typescript
// Tool API error responses
{
  success: false,
  error: {
    code: "TOKEN_EXPIRED" | "PERMISSION_DENIED" | "NOT_FOUND" | "RATE_LIMIT",
    message: "User-friendly error message",
    action?: "reconnect" | "retry" | "upgrade_plan" // Suggested fix
  }
}
```

### Edge Cases

1. **Multiple Google Accounts**: Only one account per user (unique constraint handles this)
2. **Timezone Handling**: Store UTC, display in user's timezone (from browser or Settings)
3. **Long Email Threads**: Truncate in cards, "View full thread" expands
4. **Large Calendar Queries**: Default to 7-day window, allow expanding
5. **Concurrent Token Refreshes**: Check timestamp before refresh to prevent race conditions

## Implementation Plan

### Phase 3.1: OAuth Foundation (2-3 days)

**Tasks:**
- [ ] Database migration for `permissions` column
- [ ] Google OAuth endpoints (`/api/auth/google/authorize`, `/api/auth/google/callback`)
- [ ] Token refresh helper utilities (`src/lib/google/tokens.ts`)
- [ ] Settings UI updates for Google connection
- [ ] Manual testing: connect/disconnect flow

**Files:**
- `supabase/migrations/002_add_user_permissions.sql`
- `src/app/api/auth/google/authorize/route.ts`
- `src/app/api/auth/google/callback/route.ts`
- `src/lib/google/tokens.ts`
- `src/lib/google/config.ts`
- `src/components/settings/integrations-tab.tsx`

### Phase 3.2: Calendar Tools (3-4 days)

**Tasks:**
- [ ] Calendar API routes (`list`, `create`, `update`, `delete`, `check_availability`)
- [ ] Permission checking middleware
- [ ] OpenClaw tool configuration (static config in `openclaw/config.json`)
- [ ] CalendarEventCard component
- [ ] Test via direct API calls

**Files:**
- `src/app/api/tools/calendar/list-events/route.ts`
- `src/app/api/tools/calendar/create-event/route.ts`
- `src/app/api/tools/calendar/update-event/route.ts`
- `src/app/api/tools/calendar/delete-event/route.ts`
- `src/app/api/tools/calendar/check-availability/route.ts`
- `src/lib/google/calendar.ts`
- `src/components/chat/calendar-event-card.tsx`
- `openclaw/config.json`

### Phase 3.3: Gmail Tools (3-4 days)

**Tasks:**
- [ ] Gmail API routes (`list`, `get`, `send`, `reply`, `search`)
- [ ] EmailCard component
- [ ] ConfirmationCard component
- [ ] Test via direct API calls

**Files:**
- `src/app/api/tools/gmail/list-emails/route.ts`
- `src/app/api/tools/gmail/get-email/route.ts`
- `src/app/api/tools/gmail/send-email/route.ts`
- `src/app/api/tools/gmail/reply-to-email/route.ts`
- `src/app/api/tools/gmail/search-emails/route.ts`
- `src/lib/google/gmail.ts`
- `src/components/chat/email-card.tsx`
- `src/components/chat/confirmation-card.tsx`

### Phase 3.4: End-to-End Integration (2-3 days)

**Tasks:**
- [ ] Wire up card action buttons to API routes
- [ ] Update message renderer to display cards
- [ ] OpenClaw integration testing (AI decides when to use tools)
- [ ] Full user journey testing

**Files:**
- `src/app/chat/page.tsx` (message rendering updates)
- `src/lib/types/database.ts` (add message metadata types)

### Phase 3.5: Permissions & Polish (2-3 days)

**Tasks:**
- [ ] Permissions UI in Settings
- [ ] Permission toggle functionality
- [ ] Error handling UI improvements
- [ ] Documentation and help text

**Files:**
- `src/components/settings/permissions-section.tsx`
- `src/app/api/user/permissions/route.ts`

## Testing Strategy

### Unit Tests
- Token refresh logic
- Permission checking
- Date/time formatting

### Integration Tests
- Mock Google APIs
- Test all tool endpoints
- Test OAuth flow

### Manual Testing Scenarios

**Calendar:**
- "What's on my calendar today?"
- "Schedule a meeting with john@example.com tomorrow at 2pm"
- "Do I have any free time this week?"
- "Cancel my 3pm meeting"

**Email:**
- "Show me recent emails from my boss"
- "What emails do I have about the project launch?"
- "Send an email to team@example.com saying we're launching next week"
- "Reply to that email and say I'll join the call"

**Permissions:**
- Toggle permission from "direct" to "confirm"
- Verify confirmation card appears
- Confirm action and verify it executes

## Success Criteria

- ✅ User can connect Google account via OAuth
- ✅ Calendar events appear as rich cards when queried
- ✅ Can create calendar events through natural chat
- ✅ Emails appear as cards with action buttons
- ✅ Confirmation flow works for write operations
- ✅ Tokens refresh automatically when expired
- ✅ Permissions are configurable per action type

## Rollback Plan

Environment variable feature flag:

```bash
FEATURE_GOOGLE_INTEGRATIONS=true
```

Set to `false` to disable integrations if issues arise.

## Future Enhancements (Post-Phase 3)

- Multiple Google account support
- Calendar sharing and delegation
- Email filters and rules
- Scheduled sends
- Meeting link generation (Google Meet)
- Calendar conflict detection
- Smart suggestions based on email/calendar content
