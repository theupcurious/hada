# Setup Guide

This guide matches the current codebase and `.env.local.example`.

## Prerequisites

- Node.js `>=20.9.0`
- npm
- Supabase project
- At least one supported LLM API key

## 1. Install

```bash
npm install
```

## 2. Configure Environment

```bash
cp .env.local.example .env.local
```

### Required variables

- `NEXT_PUBLIC_APP_URL` (local: `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_PROVIDER`
- `LLM_API_KEY` (or provider-specific `<PROVIDER>_API_KEY`)

### Provider options

`LLM_PROVIDER` supports:

- `openrouter`
- `minimax`
- `openai`
- `anthropic`
- `gemini`
- `kimi`
- `deepseek`
- `groq`
- `mimo`

Notes:

- `LLM_MODEL` and `LLM_BASE_URL` are optional overrides.
- Runtime will prefer `<PROVIDER>_API_KEY` when set (for example `OPENROUTER_API_KEY`) and fallback to `LLM_API_KEY`.
- Per-user provider/model settings in UI are only applied for admin users (`ADMIN_USER_EMAILS`/`ADMIN_EMAILS`).

### Optional variables

- Embeddings: `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`
- Search: `SEARCH_PROVIDER`, `SEARCH_API_KEY` (or `TAVILY_API_KEY`, `BRAVE_API_KEY`, `SERPAPI_API_KEY`)
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
- Cron auth: `CRON_SECRET`

## 3. Supabase Setup

### Create project + copy keys

From Supabase project settings/API:

- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- anon key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service role key -> `SUPABASE_SERVICE_ROLE_KEY`

### Fresh install: run one SQL file

For a brand-new Supabase project, run:

- [schema.sql](/Users/james/Projects/Coding/hada/supabase/schema.sql)

This file is generated from the migration chain and is the simplest way to bootstrap a new database.

### Existing database: run migrations (in order)

If you are upgrading an existing database, apply SQL files from `supabase/migrations` in this order:

1. `001_initial_schema.sql`
2. `002_add_user_permissions.sql`
3. `004_agent_and_telegram.sql`
4. `005_agent_runs.sql`
5. `006_background_jobs.sql`
6. `007_memory_embeddings.sql`
7. `008_messages_update_policy.sql`
8. `009_default_openrouter_provider.sql`
9. `010_documents.sql`
10. `011_agent_runs_delete_policy.sql`
11. `011_document_shares.sql`
12. `012_conversation_segments.sql`
13. `013_memory_classes.sql`
14. `014_segment_artifacts.sql`

Notes:

- `supabase/schema.sql` is for fresh installs only.
- `supabase/migrations/*.sql` is the upgrade path for existing databases and should remain in the repo.
- Do not delete the older migration files just because `schema.sql` exists. They serve different purposes.
- Regenerate it with `npm run db:schema` after changing any migration file.
- `014_segment_artifacts.sql` requires `012_conversation_segments.sql` to already exist.

## 4. Optional Integrations

### Google OAuth (Calendar tools)

Google auth routes used by the app:

- `/api/auth/google/authorize`
- `/api/auth/google/callback`

Set OAuth redirect URI to:

- `http://localhost:3000/api/auth/google/callback` (local)
- `https://<your-domain>/api/auth/google/callback` (prod)

Current requested scopes in code:

- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/userinfo.email`

### Telegram

1. Create bot with BotFather.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`.
3. Set `TELEGRAM_WEBHOOK_SECRET`.
4. Register webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<your-domain>/api/webhooks/telegram","secret_token":"<YOUR_WEBHOOK_SECRET>","allowed_updates":["message"]}'
```

Users then link Telegram from Settings via `/api/integrations/telegram/link`.

## 5. Run Locally

```bash
npm run dev
```

Main routes:

- `http://localhost:3000/`
- `http://localhost:3000/chat`
- `http://localhost:3000/docs`
- `http://localhost:3000/settings`

## 6. Scheduled/Cron Runs

Scheduled tasks and queued background jobs are processed by `/api/cron`.

If `CRON_SECRET` is set, include header:

- `x-cron-secret: <CRON_SECRET>`

Example:

```bash
curl -X POST "https://<your-domain>/api/cron" \
  -H "x-cron-secret: <CRON_SECRET>"
```

Recommended: configure a platform cron job to hit this endpoint every minute.

## 7. Verification

```bash
npm run lint
npm run test
npm run build
```

## Troubleshooting

### Unauthorized / auth loops

- Confirm Supabase URL + anon key are correct.
- Confirm `NEXT_PUBLIC_APP_URL` matches the active origin.

### Chat fails with provider key errors

- Confirm `LLM_PROVIDER` is valid.
- Set `LLM_API_KEY` or matching provider key (for example `OPENROUTER_API_KEY`).

### Google connect fails

- Verify redirect URI exactly matches `/api/auth/google/callback`.
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in runtime env.

### Telegram webhook not receiving updates

- Verify webhook URL is public HTTPS.
- Verify `TELEGRAM_WEBHOOK_SECRET` matches the webhook `secret_token`.

### No background processing

- Ensure `background_jobs` and `background_job_events` tables exist (migration `006`).
- Ensure your deployment actually triggers `/api/cron`.
