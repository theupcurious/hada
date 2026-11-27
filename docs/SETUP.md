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
- `ADMIN_USER_EMAILS` — comma-separated operator emails. Admins are exempt from plan quotas. Quotas fail closed (a request is refused if usage can't be read), so without this an operator can be locked out too.

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
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (required when the bot is enabled — the webhook returns 500 if unset)
- Cron auth: `CRON_SECRET` (required — the endpoint refuses requests when unset)
- Token encryption: `INTEGRATION_ENCRYPTION_KEY` (required for Google; `openssl rand -base64 32`)

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
15. … through `023_workflow_execution_claims.sql` (see `docs/DATABASE.md` for the full annotated chain)
24. `024_rate_limits_and_share_expiry.sql` — `rate_limits` table + `check_rate_limit` RPC, `document_shares.expires_at`. Until applied, rate limiting logs an error and allows requests.
25. `025_usage_events.sql` — usage ledger, `get_usage_summary` RPC, and a trigger that stops users changing their own `tier`. **Apply before deploying the quota code:** plan quotas fail closed, so until it's applied every non-admin chat, Telegram message, and workflow run is refused.
26. `026_billing.sql` — Stripe billing columns on `users` (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end`) and a wider guard trigger so users can't edit them. Apply before turning billing on.

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

### Stripe billing (paid plans)

Optional. Without it, everyone stays on Free and no Upgrade buttons are shown.

1. In the Stripe dashboard (test mode first), create one product per paid plan with a recurring monthly price: **Plus** and **Pro**. Prices are set here, not in code.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PLUS` and `STRIPE_PRICE_PRO` (the `price_…` ids). Limits per plan live in `src/lib/usage/plans.ts`.
3. Add a webhook endpoint at `<NEXT_PUBLIC_APP_URL>/api/webhooks/stripe` subscribed to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Configure the **Customer Portal** (Settings → Billing → Customer portal) and allow plan switching between the two prices. "Manage billing" fails until the portal is saved once.
5. `NEXT_PUBLIC_APP_URL` must be set: checkout and portal redirects are built from it.
6. Apply `026_billing.sql`.

Admins (`ADMIN_USER_EMAILS`) are exempt from quotas, so they don't see Upgrade buttons. Test checkout with a separate non-admin account and Stripe's `4242 4242 4242 4242` test card, then check that Settings → Account shows "Plus".

Locally, forward events with the Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) and use the `whsec_…` it prints. The webhook re-fetches each subscription from Stripe and sets `users.tier`, so retries and out-of-order events are safe.

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

`CRON_SECRET` must be set (the endpoint returns 500 when it is not), and every scheduler that calls `/api/cron` must send the header:

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
