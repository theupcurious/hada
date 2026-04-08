# Hada Prompt Guide

This guide is for writing prompts that make full use of Hada's actual runtime: web research, document co-authoring, long-term memory, calendar/task workflows, scheduling, and multi-step execution.

The goal is not to write "AI-sounding" prompts. The goal is to give Hada enough structure to do useful work in one pass.

## What Hada Is Best At

Hada is strongest when you ask it to do one or more of these clearly:

- research something current and cite sources
- create or update a durable document in `/docs`
- compare options and recommend a decision
- plan and track a multi-step task
- use calendar context to protect time or resolve conflicts
- save stable preferences or recurring facts to memory
- set up reminders or recurring reviews

If you only want a quick opinion or short rewrite, keep the prompt short. If you want action, give Hada a deliverable, context, and constraints.

## Prompt Formula

Good Hada prompts usually contain 4 parts:

1. Objective: what you want done
2. Context: the project, document, time frame, or background
3. Output: what the result should look like
4. Constraints: tone, deadline, sources, tradeoffs, or formatting

Template:

> "Help me with [objective]. Context: [background]. Deliverable: [output]. Constraints: [rules, date range, tone, sources, length, deadline]."

Short example:

> "Research the top 5 AI note-taking tools for startup teams in 2026. Deliverable: a comparison with pricing, strengths, weaknesses, and a recommendation for a 10-person team. Constraints: use current sources and keep it practical."

## How To Get Better Results

### Be explicit about the artifact

If you want something durable, say so.

- "Create a document called `Q2 Hiring Plan` in the `Hiring` folder."
- "Update my `Founder Bio` document instead of replying in chat."
- "Give me a short answer in chat first, then create the full document."

### Give a decision frame, not just a topic

Weak:

> "Research CRM tools."

Better:

> "Research CRM tools for a 3-person B2B startup. Compare HubSpot, Pipedrive, and Attio on setup speed, reporting, automation, and total cost. End with a recommendation."

### State when freshness matters

For anything current, say it directly:

- "Use current sources."
- "Check this week's information."
- "Verify before answering."
- "Use my schedule for today."

This pushes Hada toward research and live context instead of generic recall.

### Ask for the final shape

Examples:

- "Return a checklist."
- "Draft a memo."
- "Make this a comparison table."
- "Turn this into a review plan."
- "Give me a 3-step recommendation, not a long essay."

### Include constraints that change the answer

Useful constraints:

- audience: "for investors", "for my team", "for a client"
- time: "for today", "for this week", "before 3 PM"
- scope: "top 3 only", "keep it under 400 words"
- style: "direct, not fluffy"
- risk: "be conservative", "highlight assumptions"

## Scenario Playbook

### 1. Start a New Project

Use this when you want Hada to research, create a workspace artifact, and schedule next steps.

> "I want to start a new project called `Agent 2026`. Research the top trends in AI agents for this year, create a `Project Roadmap` document in the `Agent 2026` folder, and schedule a reminder for me to review it tomorrow at 9 AM."

More robust version:

> "I want to start a new project called `Agent 2026`. Research the top 3 commercially relevant AI agent trends for this year using current sources. Then create a `Project Roadmap` document in the `Agent 2026` folder with phases, risks, and first-week actions. Finally, schedule a review reminder for tomorrow at 9 AM. Keep the roadmap practical, not visionary."

### 2. Current Research With Sources

Use this when you need current facts, links, or market snapshots.

> "Research the latest pricing and positioning for Anthropic, OpenAI, and Google coding models. Give me a concise comparison with links and recommend which is best for a fast internal coding assistant."

Stronger version:

> "Research the latest pricing and positioning for Anthropic, OpenAI, and Google coding models. Deliverable: a comparison covering context window, tool use, latency expectations, pricing signals, and likely strengths for an internal coding assistant. Constraints: use current sources, include links, and separate confirmed facts from inference."

### 3. Deep Research Into a Document

Use this when the answer should become a reusable artifact.

> "Research the competitive landscape for AI personal assistants and create a document called `AI Assistant Market Scan` in the `Research` folder. Include key players, positioning, pricing signals, and whitespace opportunities."

Better:

> "Research the competitive landscape for AI personal assistants and create `AI Assistant Market Scan` in the `Research` folder. Structure it with an executive summary, market map, competitor breakdown, and opportunities. Use current sources. End with a point of view on where Hada could differentiate."

### 4. Compare Options and Recommend One

This works well when you want a decision instead of just information.

> "Compare Notion, Obsidian, and Capacities for personal knowledge management. Focus on search quality, writing experience, organization, and long-term maintainability. Recommend one for a solo founder."

Stronger:

> "Compare Notion, Obsidian, and Capacities for personal knowledge management. Deliverable: decision table plus recommendation. Constraints: optimize for a solo founder who wants fast capture, low maintenance, and durable archives. Do not just list features; explain the tradeoff that actually matters."

### 5. Edit an Existing Document

When a document already exists, tell Hada what to change and how.

> "Read my `Q2 Priorities` document and rewrite the `Marketing` section so it is more measurable and outcome-based."

Better:

> "Read my `Q2 Priorities` document and update the `Marketing` section. Replace vague goals with specific metrics, owners, and review cadence. Keep the rest of the document unchanged."

### 6. Turn Notes Into a Clean Draft

Good for rough notes, pasted bullets, or meeting fragments.

> "Turn these notes into a polished strategy memo and save it as `Pricing Review` in the `Strategy` folder. Keep my core argument intact but make the structure tighter."

Add control:

> "Turn these notes into a polished strategy memo and save it as `Pricing Review` in the `Strategy` folder. Use sections for context, issue, options, recommendation, and next steps. Keep it under 700 words and preserve any concrete numbers."

### 7. Daily Planning and Time Defense

Use this when you want Hada to reason across your schedule and workload.

> "Look at my calendar and tasks for today. Give me the top 3 things I should do and flag anything likely to derail me."

More robust:

> "Look at my calendar and tasks for today. Deliverable: a practical day plan with top 3 priorities, conflict warnings, and a suggested order of execution. Constraints: optimize for finishing deep work before 3 PM and call out anything that should be deferred."

### 8. Protect Focus Time

This is where the scheduler is most useful.

> "Check next week's calendar. I need 4 hours of uninterrupted time to finish the investor memo. Use Time Defense to identify low-priority meetings we can move and suggest the best focus blocks."

Better:

> "Check next week's calendar. I need 4 hours of uninterrupted time to finish the investor memo. Use Time Defense to identify low-priority meetings we can move, propose 2 realistic focus-block options, and explain the tradeoff of each."

### 9. Meeting Prep

Use Hada to assemble context and produce a meeting-ready artifact.

> "Prepare me for tomorrow's product review. Read the relevant project docs, summarize the open issues, and create a `Product Review Brief` document."

Stronger:

> "Prepare me for tomorrow's product review. Read the relevant docs in `/docs`, identify unresolved product questions, and create `Product Review Brief` with agenda, risks, open decisions, and my likely talking points."

### 10. Schedule Recurring Reviews

Good for building an operating rhythm.

> "Create a recurring Friday reminder for me to review open project risks."

More robust:

> "Create a recurring Friday 4 PM reminder called `Weekly Risk Review`. In the reminder description, include: review blockers, stale decisions, and next week's biggest uncertainty."

### 11. Save Stable Preferences to Memory

Use this for things that should carry across chats.

> "Remember that I prefer concise writing, active voice, and recommendations before background."

Good memory candidates:

- writing style preferences
- recurring scheduling constraints
- preferred meeting hours
- product strategy principles
- identity or role context that keeps coming up

Bad memory candidates:

- one-off research results
- temporary to-do lists
- today's market snapshot
- a draft that will likely change next week

### 12. Build a Personal Operating Manual

This combines memory plus documents well.

> "Create a document called `Working With Me` that captures my preferences from our recent chats: concise writing, pragmatic recommendations, and early-morning focus blocks. Then save the most durable preferences to memory."

### 13. Ask for Structured Output

Hada can present responses more usefully if you ask.

Checklist:

> "Give me a checklist for launching a private beta in the next 2 weeks."

Steps:

> "Give me a step-by-step plan for migrating my notes from Notion to Obsidian."

Comparison:

> "Compare three approaches for handling user memory in Hada: only explicit save, fully automatic extraction, or hybrid. Show tradeoffs and recommend one."

### 14. Use Documents as Context

When you want grounded work, point Hada at an existing document.

> "Read `Agent 2026 - Project Roadmap` and turn it into a shorter execution plan for the next 14 days."

Better:

> "Read `Agent 2026 - Project Roadmap` and create a 14-day execution plan. Keep the original strategy intact, but turn it into concrete tasks, milestones, and review checkpoints."

### 15. Use MCP for External Systems

Use this when you have an MCP server connected and want Hada to act through it.

> "Use my MCP GitHub server to list open issues for the main Hada repo and create a `Bug Triage` document with severity, owner suggestion, and next action."

Better:

> "Use my MCP GitHub server to review the open issues in the main Hada repo. Create `Bug Triage` in the `Engineering` folder with severity, likely area, and a recommended first response for each issue."

## Strong Prompt Patterns

### Pattern: Research -> Synthesize -> Save -> Remind

> "Research [topic] using current sources, create a document called `[name]` in `[folder]`, summarize the key decision in chat, and remind me to review it [time]."

### Pattern: Read -> Revise -> Preserve Tone

> "Read `[document]`, update the `[section]` section, keep the rest unchanged, and preserve the existing tone."

### Pattern: Review -> Prioritize -> Defend Time

> "Review my schedule and tasks for [time frame], identify the top priorities, and suggest what to move or decline so I can protect focus time."

### Pattern: Learn -> Save Only Durable Parts

> "From this conversation, save only the durable preferences or recurring facts to memory. Do not save temporary conclusions."

## How To Make Prompts More Robust

If a prompt matters, add these details:

- date or time window
- what "good" looks like
- where the output should go
- whether you want links or current verification
- what not to do

Example:

Weak:

> "Help me plan next week."

Robust:

> "Help me plan next week. Use my calendar context, optimize for deep work in the mornings, flag overloaded days, and give me a practical Monday-Friday plan. Keep it concise and tell me what should be moved, not just what exists."

## Prompting Mistakes To Avoid

### Too vague

> "Research this for me."

Better:

> "Research the best team wiki tools for a 12-person startup and recommend one."

### No deliverable

> "Think about my hiring strategy."

Better:

> "Create a one-page hiring strategy memo with role priorities, risks, and next steps."

### No time frame

> "What's happening in AI?"

Better:

> "What changed in AI coding models in the last 30 days? Use current sources and give me only the changes that matter for product decisions."

### Asking for permanent memory when the fact is temporary

Avoid:

> "Remember these three articles I asked about today."

Better:

> "Create a research note document with these three articles and the takeaways."

## When To Use Chat vs Documents

Use chat when:

- you want a quick answer
- you want a recommendation or summary
- the output is short-lived

Use documents when:

- the output should be reused later
- you want a draft, plan, memo, or report
- you expect to iterate on the result
- you want a project artifact in `/docs`

## Ready-to-Use Prompt Templates

### Project kickoff

> "Start a project called `[Project Name]`. Research the top trends in `[field]`, create a `Project Roadmap` document in the `[Project Name]` folder, and schedule a review reminder for `[time]`."

### Market scan

> "Research the market for `[category]`. Create a document called `[Name]` with competitors, positioning, pricing, risks, and opportunities. Use current sources and end with a recommendation."

### Strategy memo

> "Read `[document or notes]` and turn it into a strategy memo for `[audience]`. Keep it concise, decision-oriented, and save it as `[Document Name]`."

### Weekly review

> "Review my current projects, tasks, and upcoming schedule. Give me the top priorities for this week, what to defer, and anything that needs a reminder or follow-up."

### Writing style memory

> "Remember these writing preferences for future drafts: `[preferences]`. Save only the durable parts."

### Calendar cleanup

> "Review my calendar for `[time frame]`, identify meetings that can move or shrink, and suggest focus blocks for `[project]`."

## Final Advice

The best Hada prompts are concrete, outcome-oriented, and grounded in a real workflow. If you want better answers, ask for:

- a decision, not just information
- an artifact, not just a reply
- a time frame, not just a topic
- constraints, not just a broad goal

If a task matters, tell Hada what to produce, where to put it, and how you want success judged.
