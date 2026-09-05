# Sections 4–7 implementation

Implemented locally on 5 September 2026. No deployment, database migration, live
workflow execution, or email sending was performed. Builds on the sections 1–3
work; see [the 1–3 notes](APP-IMPROVEMENTS-1-3.md).

## Enabling change (no migration)

`agent_runs.metadata` is JSONB, so two IDs are now recorded there without a
schema change, unlocking several items below:

- `project_id` — the Space a run belongs to. Powers the Activity Space filter and
  the recent-result line on Space cards.
- `scheduled_task_id` — the workflow that triggered a scheduled run. Powers
  per-workflow run history.

Both are written in `process-message.ts` (`createAgentRunRecord`); the task id is
passed through from `execute-workflow.ts`. Existing rows predating this change
carry neither, so they simply don't appear in the new Space/run-history views —
new runs populate them going forward.

## 4. Documents and search

- Recent documents are shown on entry: with no document open, Docs now renders a
  "Your documents" landing listing the most recent documents (plus New and, on
  narrow screens, Browse), instead of the bare "Select a document" screen.
- A labeled **Browse documents** action is present on small screens (header
  button and the landing), each with an accessible name.
- The last opened document is restored on re-entry (localStorage), unless a
  `?id=` deep link overrides it.
- Document search is in the drawer/sidebar: a labeled search box filters by
  title, folder, and preview text, showing a flat result list with folder hints.
- Incorrectly encoded names (e.g. `Health &amp; Fitness`) are fixed at the write
  boundary: `decodeIdentifierEntities` decodes a small, safe set of named/numeric
  HTML entities for **identifiers only** (title, folder) in the create/update
  document tools and the documents POST/PATCH routes. Bodies are never decoded at
  render time, per the audit's caution. Rows already stored corrupt are not
  rewritten (no DB access); they normalize the next time their title/folder is
  saved. A one-off data cleanup remains a deployment step if desired.
- Icon-only controls are labeled: New document, Upload, drawer close, graph
  toggle, folder delete, and per-document rename/delete now have accessible names.
- Conversation search reaches message content: a new `/api/search` endpoint
  searches message text (mapped back to its topic/segment) and returns snippets;
  the history panel merges these under an **In messages** group alongside the
  existing topic-title/summary matches.
- Saved outputs are in search: the same endpoint searches documents (title +
  body); the history panel shows them under a **Documents** group with snippets,
  and the scope is explicit via the three group headers (Topics / In messages /
  Documents). Selecting a document opens it in Docs.

## 5. Spaces

- Space cards show a recent result (latest run's cleaned excerpt + relative time),
  sourced from Activity via the new `project_id` tag.
- The **Custom** badge now reads "Custom instructions" with an explanatory
  tooltip, so it communicates what it means.
- Deletion moved into an overflow (⋯) menu, separated from the routine Customize
  action; the menu closes on outside-click/Escape and is keyboard reachable.
- Configuration is reordered to **Purpose & instructions → Tools & memory scope →
  Starter prompts → Appearance**, in both the create form and the inline editor.
- Both forms use a persistent (sticky) Save/Cancel footer so the controls stay
  reachable without scrolling.
- A short banner explains what each Space shares (documents, integrations) versus
  keeps separate (chat, memory, instructions).
- Configuration fields have accessible labels (`htmlFor`/`id` and `aria-label`),
  including the icon/color pickers, starter-prompt inputs, and the tool checkboxes.

## 6. Workflows

- Templates take an optional **Topic or focus** field, appended to the prompt on
  creation.
- A **Space** picker lets users choose the Space a workflow runs in; the POST and
  PATCH task routes accept `project_id` (migration 022 column).
- The timezone is shown explicitly (IANA name + GMT offset) in the setup review.
- The setup shows a readable schedule and the **exact next run** before creation,
  computed client-side from the cron.
- The delivery destination is shown ("Delivered to your Hada chat · also sent to
  Telegram when connected").
- Raw cron is replaced by friendly schedules in the active list
  (`cronRecurrenceLabel`), with the cron expression retained under an **Advanced**
  disclosure. The gallery keeps the same Advanced disclosure.
- Existing workflows are editable: an inline editor updates instructions, Space,
  and (opt-in) schedule; schedule changes are only sent when explicitly toggled,
  so editing other fields never silently reschedules.
- Per-workflow run history is available via a collapsible list backed by
  `/api/dashboard/tasks/[id]/runs` (agent runs tagged with `scheduled_task_id`).
- Active workflows are listed **before** the template gallery.
- Templates that need a disconnected integration sink to the bottom, and Google
  templates show an inline **Connect** link to Integrations.
- The empty state acknowledges both template creation and describing a workflow
  in chat.
- Duplicated headings/intros were consolidated into one page title/subtitle plus
  section headers.

### Not implemented in this pass (with reasons)

- **Preserve named timezone across travel and daylight-saving changes.** The
  timezone is now *displayed*, but preserving named-timezone semantics needs a
  `timezone` column on `scheduled_tasks` and timezone-aware cron evaluation in
  both `/api/cron` and the dashboard next-run estimate (today both match UTC and
  the cron bakes in the offset at creation). That is a schema + evaluator change
  and no DB connection was available, so the box is left unchecked rather than
  half-done.

## 7. Activity and results

- Each run links to its conversation via an **Open conversation** action carrying
  the Space (`/chat?project=…`). It opens the conversation rather than scrolling
  to the exact message — the run record does not store the assistant message id.
- Space and status filters were added (server-side; Space filter uses the new
  `metadata.project_id` tag, "General" = untagged).
- Excerpts are cleaned of literal Markdown markers before display.
- Repeated tool calls are combined into one badge with a count (e.g.
  **Searched the web ×3**); a run-level error is shown once.
- Status is readable and distinguishes **Completed**, **Completed with warnings**
  (a completed run with a failed tool call), **Failed**, **Timed out**, and
  **Running**, each with a labeled icon.

### Not implemented in this pass (with reasons)

- **Retry for eligible failed runs.** A faithful retry needs the run's full
  original input and a safe re-issue path. `input_preview` is truncated to 200
  chars (not faithful), and web/telegram runs have no server-side re-run entry
  point. Scheduled-source retries would be the only safe subset and still require
  linking each run to its task's run endpoint plus a retry action; left unchecked
  rather than shipping an unfaithful retry. (Workflows themselves already have a
  **Run now** control.)

## Verification

- `npx tsc --noEmit` and ESLint pass on all changed files.
- Test suite: the existing 108 tests across 31 files still pass; 12 new tests
  were added for the pure helpers (`decode-entities`, workflow `schedule`
  next-run and friendly-label derivation, including a timezone round-trip).
- Runtime browser verification was blocked: the in-app preview browser was
  unresponsive this session and the local dev server did not respond to HTTP
  smoke tests in time (a large Turbopack recompile after the edits). The changes
  are static-verified (types, lint, tests) but the live flows above were not
  exercised in a browser, consistent with the 1–3 verification limits.

## Deployment notes

- No new required migration. `project_id`/`scheduled_task_id` live in existing
  JSONB. Workflow Space assignment relies on migration 022 (`scheduled_tasks
  .project_id`), already a prerequisite of the 1–3 work.
- Optionally, a one-off data cleanup can normalize pre-existing document
  titles/folders that were stored with HTML entities; new saves fix themselves.
- The named-timezone and run-retry items remain for a future pass (see reasons
  above).
