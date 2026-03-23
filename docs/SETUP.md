# Setup Guide

Complete guide to setting up Hada for local development and production deployment.

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)
- **Supabase account** - [Sign up](https://supabase.com) (free tier available)
- **Railway account** - [Sign up](https://railway.app) (for deployment)

## Local Development Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd hada
npm install
```

### 2. Set Up Supabase

#### Create a Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name:** hada (or your preference)
   - **Database Password:** Generate a strong password (save this!)
   - **Region:** Choose closest to your users
5. Click "Create new project" and wait for setup (~2 minutes)

#### Get Your API Keys

1. Go to **Project Settings** (gear icon) → **API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

#### Run Database Migrations

1. Go to **SQL Editor** in Supabase dashboard
2. Click "New query"
3. Copy the contents of each migration file in `supabase/migrations/` in order
4. Paste and click "Run" for each
5. You should see "Success. No rows returned"

#### Enable Google OAuth (Optional)

1. Go to **Authentication** → **Providers**
2. Find **Google** and enable it
3. Set up a Google Cloud project with OAuth 2.0 credentials
4. Add authorized redirect URI: `https://<your-supabase-url>/auth/v1/callback`
5. Enter your Google Client ID and Secret in Supabase

### 3. Set Up Google Calendar & Gmail Integration (Optional)

#### Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable required APIs:
   - Go to **APIs & Services** → **Library**
   - Search and enable **Google Calendar API**
   - Search and enable **Gmail API**

#### Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Configure OAuth consent screen:
   - User Type: **External**
   - App name: **Hada**
   - Scopes: Add `calendar` and `gmail.modify`
   - Test users: Add your email
4. Create OAuth Client ID:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/api/auth/google/callback`
     - Production: `https://your-domain.com/api/auth/google/callback`
5. Copy **Client ID** and **Client Secret**

### 4. Set Up Telegram Bot (Optional)

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** → `TELEGRAM_BOT_TOKEN`
4. Generate a random secret for webhook verification → `TELEGRAM_WEBHOOK_SECRET`

### 5. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# LLM Provider (at least one required)
LLM_PROVIDER=minimax
MINIMAX_API_KEY=your-minimax-api-key
# Optional: allow per-user provider/model overrides for listed admin emails
# ADMIN_USER_EMAILS=admin@example.com,ops@example.com

# Optional: Additional LLM providers
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# GEMINI_API_KEY=
# MOONSHOT_API_KEY=
# DEEPSEEK_API_KEY=
# GROQ_API_KEY=

# Google OAuth (optional - for Calendar & Gmail)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# Telegram (optional)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_WEBHOOK_SECRET=

# Web Search (optional)
# SEARCH_PROVIDER=tavily
# SEARCH_API_KEY=
# Optional provider-specific keys (if SEARCH_API_KEY is not set)
# BRAVE_API_KEY=
# BRAVE_SEARCH_API_KEY=
# SERPAPI_API_KEY=
# TAVILY_API_KEY=
```

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Deployment (Railway)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-detect Next.js

### 3. Configure Environment Variables

In Railway dashboard:

1. Click on your service
2. Go to **Variables** tab
3. Add all required environment variables from `.env.local`

### 4. Configure Domain

1. Go to **Settings** tab
2. Under **Domains**, click "Generate Domain" or add a custom domain

### 5. Set Up Telegram Webhook (if using Telegram)

After deployment, register your webhook URL with Telegram:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/webhooks/telegram", "secret_token": "<YOUR_WEBHOOK_SECRET>"}'
```

### 6. Update Supabase Redirect URLs

If using OAuth:

1. Go to Supabase → **Authentication** → **URL Configuration**
2. Add your Railway domain to:
   - **Site URL:** `https://your-app.railway.app`
   - **Redirect URLs:** `https://your-app.railway.app/auth/callback`

## Troubleshooting

### "Missing Supabase environment variables"

- Ensure `.env.local` exists and has correct values
- Restart the dev server after changing env vars

### OAuth redirect not working

- Check redirect URLs in Supabase match your app URL exactly
- For local dev, ensure `http://localhost:3000/auth/callback` is in redirect URLs

### Database migration errors

- Ensure you're running the migration in the SQL Editor, not CLI
- Check for any existing tables that might conflict
- Run migrations in order (001, 002, 003, 004...)

### Telegram bot not responding

- Verify webhook is registered: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Check webhook URL is publicly accessible
- Verify `TELEGRAM_WEBHOOK_SECRET` matches what was set in `setWebhook`

### Build fails on Railway

- Check that all environment variables are set in Railway
- View build logs for specific errors

## Next Steps

After setup, you can:

1. Create an account at `/auth/signup`
2. Access the chat interface at `/chat`
3. Connect integrations at `/settings`
