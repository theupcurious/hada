# Hada App Improvement Checklist

Date: 5 September 2026

Consolidated recommendations from the source review and signed-in design audit, with duplicates removed. Suggested order: reliability → usability → visual and accessibility polish.

Checked items are implemented locally. Sections 1–3 have been implemented and verified as described in [the implementation notes](APP-IMPROVEMENTS-1-3.md). Workflow execution requires migration 023 to be applied before deployment; live workflow runs and email sending were not exercised.

## 1. Reliability and error handling — highest priority

- [x] Fix the Docs editor crash when opening an existing document.
- [x] Add a recoverable error state so an editor failure does not take down the entire page.
- [x] Add document autosave with **Saving / Saved / Couldn’t save** indicators.
- [x] Preserve recovery drafts and protect unsaved edits when switching documents or leaving the page.
- [x] Show actionable save errors with retry.
- [x] Make scheduled execution and **Run now** use the same Space, instructions, memory, conversation, and tool permissions.
- [x] Disable repeated workflow submissions while running; add server-side duplicate protection.
- [x] Show workflow progress, completion, and an **Open result** action.
- [x] Surface failures when running, pausing, resuming, or deleting workflows.
- [x] Replace raw provider errors and JSON in chat with understandable messages and recovery actions; keep technical details expandable.
- [x] Show onboarding save failures and allow users to continue when preference saving fails.
- [x] Make the entire outgoing email inspectable before approval, with an option to edit it.

## 2. Navigation and app structure

- [x] Use a consistent navigation shell across **Chat, Spaces, Docs, Workflows, and Activity**.
- [x] Promote Workflows from Settings into a main destination.
- [x] Keep account preferences and integrations in Settings.
- [x] Simplify the crowded narrow-screen header with labeled primary destinations and a **More** menu.
- [x] Keep the active Space visible when viewing documents or other outputs.
- [x] Synchronize Settings tabs with the URL so refresh, links, and browser navigation behave correctly.
- [x] Reset or restore scroll position appropriately when switching Settings tabs.

## 3. Chat and first-use experience

- [x] Let new users complete one useful task before asking for extensive preferences.
- [x] Collect preferences progressively while retaining optional setup and Skip.
- [x] Give **Continue** entries meaningful task titles instead of low-information text such as “hello.”
- [x] Rename “9 docs in progress” if it simply counts saved documents.
- [x] Reduce competing next-action rows: prioritize contextual follow-ups over simultaneously showing generic starters.
- [x] Give failed responses appropriate recovery controls instead of treating them exactly like successful answers.
- [x] Add a persistent accessible label to the message composer.

## 4. Documents and search

- [ ] Show recent documents and search immediately when entering Docs.
- [ ] Add a clearly labeled **Browse documents** action on smaller screens.
- [ ] Consider restoring the last opened document.
- [ ] Add document search to the drawer.
- [ ] Fix incorrectly encoded names such as `Health &amp; Fitness` at the appropriate data boundary.
- [ ] Label drawer, upload, close, and other icon-only controls.
- [ ] Extend conversation search beyond topic titles and summaries to message content.
- [ ] Include saved outputs in search, with useful snippets and explicit search scope.

## 5. Spaces

- [ ] Add recent activity or a recent result to Space cards.
- [ ] Explain the **Custom** badge or remove it when redundant.
- [ ] Move Space deletion into an overflow menu.
- [ ] Reorder configuration: **Purpose and instructions → Tools and memory scope → Starter prompts → Appearance**.
- [ ] Use a dedicated configuration panel with readily accessible Save/Cancel controls.
- [ ] Clearly explain what each Space shares and keeps separate.
- [ ] Attach accessible labels to configuration fields.

## 6. Workflows

- [ ] Add editable task instructions or topic fields to templates.
- [ ] Allow users to choose the Space a workflow belongs to.
- [ ] Show the timezone explicitly.
- [ ] Preserve named timezone behavior across travel and daylight-saving changes.
- [ ] Let users review the delivery destination.
- [ ] Show a readable schedule and exact next run before creation.
- [ ] Replace raw cron expressions with friendly schedules; retain cron under advanced details.
- [ ] Add editing for existing workflows.
- [ ] Add per-workflow run history.
- [ ] Show active workflows before the template gallery.
- [ ] Prioritize templates that work with current connections.
- [ ] Offer a direct connection action for templates requiring Google.
- [ ] Update the empty state to acknowledge both template creation and scheduling through chat.
- [ ] Remove duplicated headings and introductory copy.

## 7. Activity and results

- [ ] Link each run to its conversation, document, or other result.
- [ ] Add retry for eligible failed runs.
- [ ] Add Space and status filters.
- [ ] Render clean excerpts instead of literal Markdown markers.
- [ ] Combine repeated tool badges, such as **Searched the web ×3**.
- [ ] Show each error once.
- [ ] Distinguish **Completed**, **Completed with warnings**, and **Failed** where supported by actual execution status.
- [ ] Use readable status labels alongside icons.

## 8. Memory

- [ ] Show whether each memory belongs to General or a specific Space.
- [ ] Add filtering by Space.
- [ ] Replace machine-style keys with friendly titles.
- [ ] Move the large explanatory section into expandable help.
- [ ] Add a review/archive flow for outdated or time-specific memories.
- [ ] Keep the explanation that clearing chat history does not clear memory.
- [ ] Add a persistent accessible search label.

## 9. Integrations and visual consistency

- [ ] Prioritize available integrations; move planned integrations into a smaller secondary section.
- [ ] Keep theme behavior consistent between landing, authentication, and the app.
- [ ] Standardize primary buttons, headers, spacing, and page titles.
- [ ] Remove repeated headings and excessive explanatory copy throughout Settings.
- [ ] Shorten the landing hero on smaller screens and bring the product demonstration higher.
- [ ] Preserve the current teal identity, restrained cards, and open chat layout.

## 10. Accessibility and localization

- [ ] Add missing accessible names to inputs and icon buttons.
- [ ] Add proper focus trapping and focus restoration to drawers/dialogs.
- [ ] Ensure visible keyboard focus and practical touch targets.
- [ ] Respect reduced-motion preferences consistently.
- [ ] Complete localization across Spaces, Docs, Activity, onboarding, workflows, and approval cards.
- [ ] Measure muted-text and control contrast in both themes.
- [ ] Verify keyboard navigation, screen-reader announcements, zoom, and responsive layouts.

## Evidence and verification limits

The **Docs crash was reproduced locally**. Unsaved-edit handling, workflow Space parity, and approval truncation were identified in code; their full live flows still need verification.

The visual audit used the current narrow in-app browser viewport. Production behavior, wider layouts, phone-size layouts, live integrations, and complete accessibility testing remain unverified. No app code or account data was changed during the audit.

Supporting audit reports and screenshots:

- [Initial source and public-screen review](../ux-audit-output/2026-09-05-codex/review.md)
- [Signed-in review and reproduction details](../ux-audit-output/2026-09-05-codex/signed-in-review.md)

These supporting files are local audit artifacts; keep them alongside the checklist if sharing its evidence links.
