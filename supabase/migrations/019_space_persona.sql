-- Slice 3: per-space persona (visual identity).
--
-- Each space can carry an emoji and an accent color so it reads as a distinct
-- assistant at a glance — in the space switcher, the chat header, and the
-- spaces list. Both are optional; when unset the UI falls back to the existing
-- hashed-hue dot, so pre-existing spaces keep working with no backfill.
--
--   emoji — a single emoji character, e.g. '📈' (NULL = no emoji, show a dot).
--   color — an accent as a hex string, e.g. '#14b8a6' (NULL = hashed fallback).
--
-- Purely additive: two nullable columns, no drops, no data movement. Safe to
-- re-run (add column if not exists).

begin;

alter table projects add column if not exists emoji text;
alter table projects add column if not exists color text;

commit;

-- VERIFY AFTER APPLYING — both columns should now exist:
--   select column_name from information_schema.columns
--   where table_name = 'projects' and column_name in ('emoji', 'color');
--   -- expect two rows: color, emoji
