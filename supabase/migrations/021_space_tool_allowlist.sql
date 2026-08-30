-- Slice 6: per-space tool allowlist.
--
-- Each space can restrict which optional tools its assistant may use, so an
-- "Investing" space can be prevented from touching Gmail, or a "Reading" space
-- from scheduling tasks. This is the capability half of a space's identity:
-- alongside its instructions and memory scope, it now also decides what the
-- assistant is allowed to *do*.
--
--   tool_allowlist — text[] of gateable tool names the space may use.
--                    NULL  = unrestricted (all tools) — the default, and what
--                            every existing space keeps.
--                    []    = no gateable tools (chat + core essentials only).
--                    [...] = exactly those gateable tools, plus the always-on
--                            core tools (memory, planning, cards) which are
--                            never gated.
--
-- Purely additive: one nullable array column, no drops, no data movement. Safe
-- to re-run (add column if not exists). Existing spaces keep working (NULL →
-- all tools). Enforcement lives in tool-registry.getAvailable; a missing column
-- degrades to unrestricted, so chat never breaks if this hasn't been applied.

begin;

alter table projects add column if not exists tool_allowlist text[];

commit;

-- VERIFY AFTER APPLYING — the column should now exist:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'projects' and column_name = 'tool_allowlist';
--   -- expect one row: tool_allowlist | ARRAY
