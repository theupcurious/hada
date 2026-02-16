# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
- Replaced OpenClaw gateway architecture with a built-in agent loop runtime.
- Added shared `processMessage()` pipeline for web, Telegram, and scheduled flows.
- Added multi-provider LLM registry and user-selectable provider/model settings.
- Added system prompt layering (persona + user context + memories + tools + channel context).
- Added long-term memory table and tools (`save_memory`, `recall_memory`).
- Added conversation context management with sliding window and compaction support.
- Added Telegram integration:
  - Deep-link account linking
  - Webhook handling for inbound messages
  - Live message edits and MarkdownV2 formatting
- Added scheduled tasks:
  - `scheduled_tasks` table
  - `schedule_task` tool
  - `/api/cron` execution route
- Added web research tools:
  - `web_search` (tavily/serpapi/brave)
  - `web_fetch`
- Added schema migration `004_agent_and_telegram.sql` for memories, Telegram tokens, tasks, and user settings.
- Updated settings UI for Telegram linking and model/provider preferences.
- Removed legacy OpenClaw code, config, and Docker integration.
- Improved response sanitization:
  - Strips leaked `<think>` content
  - Strips leaked tool protocol blocks
  - Normalizes markdown table output into cleaner bullet formatting
