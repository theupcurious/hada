-- Slice 4: per-space starter suggestions.
--
-- Each space can carry a short list of starter prompts, prefilled from its
-- template at creation. The chat home renders them as the empty-state cards
-- when you're inside that space, so a space reads as a specialized assistant
-- (its own suggestions) rather than General with a colored dot.
--
--   suggestions — text[] of short prompts, e.g. ARRAY['Summarize today''s macro news'].
--                 NULL or empty = fall back to the general starter cards.
--
-- Purely additive: one nullable array column, no drops, no data movement. Safe
-- to re-run (add column if not exists). Existing spaces keep working (NULL →
-- general starters); only spaces created from a template after this migration
-- carry suggestions.

begin;

alter table projects add column if not exists suggestions text[];

commit;

-- VERIFY AFTER APPLYING — the column should now exist:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'projects' and column_name = 'suggestions';
--   -- expect one row: suggestions | ARRAY
