# Sections 8–10 implementation

Implemented locally on 6 September 2026. No deployment or database migration was
performed. Builds on the sections 1–7 work; see
[the 4–7 notes](APP-IMPROVEMENTS-4-7.md). Static verification only this session —
`tsc --noEmit`, `eslint .`, and `vitest run` (126 tests) all clean — the dev
server was unavailable, so nothing was exercised in a browser.

## Enabling facts (no migration)

- `user_memories.project_id` already exists (migration 018) but was missing from
  the `UserMemory` TypeScript type; it is now added. The memories API already
  returns it via `select("*")`, so Space display and filtering needed **no** API
  change. Scoping semantics stay owned by the `save_memory` agent tool — the
  Memory tab only **shows** and **filters** by Space, it does not set scope.

## 8. Memory

- **General vs Space** — each memory now shows a scope badge: "General" (global,
  `project_id` null) or the Space's emoji + name. Archived Spaces still label
  correctly (a memory can outlive its Space) via a full id→label map, even though
  archived Spaces are not offered as filter options.
- **Filter by Space** — a Space `<select>` (All Spaces / General / each Space)
  combines with the text search.
- **Friendly titles** — the stable machine key (`work-hours`) is humanized for
  display via `formatTopicTitle` in `src/lib/memory/format-topic.ts`
  ("Work Hours"). The key is an identity (it is in the
  `(user_id, project_id, topic)` unique index and how `save_memory` resolves a
  row to update), so the **edit form still reads and writes the raw key** — the
  humanized form is never persisted, which would otherwise make the agent's next
  write insert a duplicate. Search matches the raw key, the humanized title, and
  the content, so "work hours" finds `work-hours`. Covered by unit tests.
- **Expandable help** — the "How memory works" card is now a collapsible
  `<details>` disclosure, keeping the explanation available without occupying the
  top of the tab.
- **Clearing chat does not clear memory** — this explanation
  (`memoryExplanationTwo`) is retained, now inside the expandable help.
- **Accessible search label** — the search input has a visually-hidden `<label>`
  plus `aria-label`; the Space filter is labeled the same way.

Not done:

- **Review/archive flow for outdated memories** — left unchecked. `user_memories`
  has no `archived` column and, unlike `agent_runs`, no JSONB column to record an
  archive decision non-destructively, so a faithful archive flow needs a
  migration. (Deleting outdated memories already works; archive-proper does not.)

## 9. Integrations and visual consistency

- **Prioritize available integrations** — the Integrations tab now groups
  connectable integrations (Google, Telegram) under an "Available" heading as
  full cards, and moves the planned ones (WhatsApp, Microsoft) into a smaller,
  dashed secondary "Planned" section. New localized headings in all four locales.
- **Remove repeated Settings headings** — on mobile the Settings page rendered an
  `<h1>` of the tab label plus its description, and each tab body already renders
  its own `<h2>` title + subtitle, so two identical headings stacked. The
  mobile block is reduced to the "Settings" context eyebrow; the tab's own
  heading now serves as the title (matching desktop, which never duplicated).
- **Shorten the landing hero on small screens / bring the demo higher** — reduced
  the hero's mobile top padding and deferred the trust/boundary note to `sm+`, so
  the smallest screens reach the CTAs and the `ProductPreview` demo sooner.
- **Preserve the teal identity, restrained cards, open chat layout** — honored;
  all edits use the existing zinc/teal tokens and card styles, nothing removed.

Not done:

- **Consistent theme across landing, auth, and app** — left unchecked. Auth and
  app are already theme-aware (`bg-zinc-50 dark:bg-zinc-950`); the landing is a
  deliberate fixed-light brand surface (`bg-[#f7f6f2]`). Making the marketing
  page theme-aware is a redesign, not a consistency bug fix, so it is out of
  scope here.
- **Standardize primary buttons, headers, spacing, and page titles app-wide** —
  left unchecked. Standardized within the Settings surfaces touched (shared
  eyebrow/section-heading pattern, Button variants), but a reviewable app-wide
  spacing/title sweep is a larger dedicated pass.

## 10. Accessibility and localization

- **Accessible names** — added labels to the Memory search and Space filter. A
  sweep of the other icon-only controls (message actions, theme toggle, attach
  menu, history close, Spaces overflow/customize/remove, chat stop) confirmed
  they already carry `aria-label`s from the 1–7 work.
- **Focus trapping and restoration** — `ConfirmDialog` already trapped Tab,
  restored focus, locked scroll, and handled Escape. The chat history drawer and
  the ⌘K command palette (both `aria-modal` dialogs) handled Escape + initial
  focus but neither trapped Tab nor restored focus; both are now added (focus
  returns to the opener on close). Popover menus (attach menu, Spaces overflow)
  are non-modal click-dismiss surfaces and are intentionally left as-is.
- **Visible keyboard focus + touch targets** — added a global `:focus-visible`
  outline for raw interactive elements (icon `<button>`s, links, `<summary>`,
  custom controls), excluding the `Button` component which ships its own ring, so
  there is no double indicator. Touch targets rely on the existing Button icon
  sizes (32–40px); a strict 44px audit is noted as remaining.
- **Reduced motion** — the global CSS only tames CSS animations/transitions;
  Framer Motion animates in JS, so a `MotionConfig reducedMotion="user"` provider
  now wraps the app (`src/components/motion/motion-provider.tsx`), disabling
  transform/layout animations under the OS setting while keeping opacity
  crossfades. The chat page's JS smooth-scrolls (`scrollToBottom("smooth")`) fall
  back to instant when reduced motion is requested.

Not done:

- **Complete localization across Spaces, Docs, Activity, onboarding, workflows,
  and approval cards** — left unchecked. Onboarding, approval cards, and chat are
  localized, but the Spaces (`projects/page.tsx`), Docs (`docs/page.tsx`), and
  Activity (`activity/page.tsx`) pages have no locale wiring at all (~40/66/29
  user-facing strings each), and `workflow-gallery.tsx` is English-only by an
  existing deliberate convention. Localizing these to the
  `Record<AppLocale, …Copy>` pattern × four languages is a large, per-language
  effort; a partial translation is worse than either endpoint, so it is recorded
  as scoped remaining work rather than half-done.
- **Measure muted-text and control contrast in both themes** — left unchecked;
  this is a measurement task and the dev server was unavailable to run it.
- **Verify keyboard navigation, screen-reader announcements, zoom, and responsive
  layouts** — left unchecked; a verification task requiring a running app and
  assistive-tech tooling, not exercised this session.

## Verification

- `tsc --noEmit` clean.
- `eslint .` clean.
- `vitest run` — 126 tests passing (added `format-topic.test.ts`, 6 tests).
- No browser verification (dev server unavailable this session).
