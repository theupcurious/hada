# OpenRouter Reasoning Support Plan

## Goal

Add proper reasoning support for OpenRouter-backed models in Hada's agent loop, including:

- request-side reasoning controls
- response parsing for reasoning metadata
- preserved reasoning round-tripping across tool calls
- capability-aware settings in account preferences

This should support reasoning-capable OpenRouter model families broadly, not only one vendor.

## Problem

Hada currently treats OpenRouter like a generic OpenAI-compatible chat endpoint. That is enough for plain text and tool calls, but not enough for reasoning-enabled models.

Current gaps:

- [src/lib/chat/providers.ts](/Users/james/Projects/Coding/hada/src/lib/chat/providers.ts) does not send OpenRouter `reasoning` parameters.
- Streaming and non-streaming parsing only capture `content` and `tool_calls`.
- [src/lib/chat/agent-loop.ts](/Users/james/Projects/Coding/hada/src/lib/chat/agent-loop.ts) drops assistant-side reasoning metadata before the next tool turn.
- [src/components/settings/account-tab.tsx](/Users/james/Projects/Coding/hada/src/components/settings/account-tab.tsx) has no reasoning controls.
- [src/lib/types/database.ts](/Users/james/Projects/Coding/hada/src/lib/types/database.ts) has no persisted settings for reasoning preferences.

Without preserved reasoning, multi-step tool loops lose continuity for models that expect `reasoning_details` to be passed back on later turns.

## Scope

### In Scope

- OpenRouter reasoning request support
- Preserved reasoning parsing and round-trip support
- Capability detection by OpenRouter model family
- Settings UI for enabling thinking and choosing effort where supported
- Tests for provider parsing, request generation, and agent-loop continuity

### Out of Scope

- Direct vendor API integrations for xAI, DeepSeek, Alibaba, Moonshot, Xiaomi, Z.ai, or MiniMax
- New conversation storage schema for persisted chain-of-thought
- UI display of raw reasoning blocks
- Reworking model-selection architecture beyond what is needed for reasoning gating

## Supported Model Families

This feature should be implemented as generic OpenRouter reasoning support with model-family capability gating.

Initial model families to support:

- `x-ai/*`
- `deepseek/*`
- `qwen/*`
- `xiaomi/*`
- `minimax/*`
- `z-ai/*`
- `moonshotai/*`

Representative models:

- `x-ai/grok-4.1-fast`
- `deepseek/deepseek-v3.2`
- `qwen/qwen3.6-plus`
- `xiaomi/mimo-v2-omni`
- `minimax/minimax-m2.7`
- `z-ai/glm-5.1`
- `moonshotai/kimi-k2.5`

## Capability Model

Do not model this as a single boolean. OpenRouter reasoning support differs across families.

Define three capability flags:

- `supportsReasoningToggle`
- `supportsPreservedReasoning`
- `supportsEffort`

And one derived tier for UI copy:

- `full`: reasoning + preserved reasoning suitable for tool loops
- `partial`: reasoning supported, preserved reasoning not reliable
- `experimental`: reasoning appears supported, but Hada has not verified continuity well enough to treat it as full

Initial capability assumptions:

- `x-ai/*`: full, with effort support
- `qwen/*`: full
- `minimax/*`: full
- `moonshotai/*`: full for Kimi thinking-capable families
- `xiaomi/*`: full for current MiMo V2 reasoning-capable families, but verify `omni` behavior in tests
- `z-ai/*`: partial because reasoning is available but preserved reasoning should not be relied on yet
- `deepseek/*`: experimental because reasoning is documented on OpenRouter model pages, but preserved reasoning support is less explicit in the main reasoning docs

These rules should live in a dedicated helper rather than being spread across settings and provider code.

## Architecture Changes

### 1. Provider Layer

Update [src/lib/chat/providers.ts](/Users/james/Projects/Coding/hada/src/lib/chat/providers.ts):

- Extend `LLMMessage` to carry OpenRouter reasoning metadata on assistant messages.
- Extend `LLMResult` and `LLMStreamEvent` so reasoning metadata is available to the agent loop.
- Add an OpenRouter request builder helper to inject:
  - `reasoning.enabled`
  - `reasoning.effort` when supported and configured
- Parse reasoning metadata from:
  - streaming deltas
  - final streamed completion payload
  - non-streaming completion payload

The provider layer must preserve reasoning metadata without exposing it as user-visible text.

### 2. Agent Loop

Update [src/lib/chat/agent-loop.ts](/Users/james/Projects/Coding/hada/src/lib/chat/agent-loop.ts):

- When an assistant turn completes, append any preserved reasoning metadata into the assistant message stored in `llmMessages`.
- Pass that metadata back on the next model call unchanged.
- Keep the existing `thinking` event behavior separate from preserved reasoning.

Important constraint:

- preserved reasoning is runtime continuity state
- it must not be shown to the user as raw model reasoning
- it does not need to be saved into database message history

### 3. Capability Helper

Add a helper module, likely:

- [src/lib/openrouter/reasoning.ts](/Users/james/Projects/Coding/hada/src/lib/openrouter/reasoning.ts)

Responsibilities:

- identify whether a model is an OpenRouter reasoning-capable model
- classify the model into the capability flags above
- determine whether effort controls should be shown
- produce simple UI-facing labels such as `full`, `partial`, or `experimental`

### 4. Settings Model

Update [src/lib/types/database.ts](/Users/james/Projects/Coding/hada/src/lib/types/database.ts):

- add `llm_reasoning_enabled?: boolean`
- add `llm_reasoning_effort?: "low" | "medium" | "high" | "xhigh"`

These settings should remain optional and backward-compatible.

### 5. Settings UI

Update [src/components/settings/account-tab.tsx](/Users/james/Projects/Coding/hada/src/components/settings/account-tab.tsx):

- show reasoning controls only when:
  - the provider is `openrouter`
  - the selected model supports reasoning
- add a `Thinking` toggle
- add a `Thinking level` select only when the selected model supports effort controls
- add short capability notes:
  - `Full reasoning support`
  - `Reasoning only`
  - `Experimental preserved reasoning`

These controls belong in the first settings section: `Providers, language & timezone`.

## Data Flow

1. User selects an OpenRouter model and enables `Thinking`.
2. Settings persist `llm_reasoning_enabled` and optional `llm_reasoning_effort`.
3. `resolveProviderSelection` and the LLM call path load the selected provider/model/settings.
4. OpenRouter requests include `reasoning` when the model supports it.
5. Provider parsing collects `reasoning_details` from the assistant response.
6. `agentLoop` stores those details on the assistant turn in runtime message history.
7. The next tool-followup model call includes the preserved reasoning metadata.

## File Plan

- `docs/plans/2026-04-08-openrouter-reasoning-support.md`
- `src/lib/chat/providers.ts`
- `src/lib/chat/agent-loop.ts`
- `src/lib/openrouter/reasoning.ts`
- `src/lib/types/database.ts`
- `src/components/settings/account-tab.tsx`
- `src/lib/chat/__tests__/providers-*.test.ts`
- `src/lib/chat/__tests__/agent-loop-*.test.ts`

## Implementation Phases

### Phase 1: Provider Transport Support

- Add reasoning config types.
- Add OpenRouter request-body support for `reasoning`.
- Extend stream and non-stream result types to carry reasoning metadata.
- Parse preserved reasoning from responses.

Deliverable:

- provider layer can request reasoning and return reasoning metadata to callers

### Phase 2: Agent Loop Continuity

- Extend assistant runtime messages to keep preserved reasoning metadata.
- Pass that metadata through tool iterations.
- Add tests covering a reasoning-enabled tool call followed by another LLM turn.

Deliverable:

- reasoning-enabled OpenRouter models can keep continuity in multi-step tool loops

### Phase 3: Capability Gating

- Implement model-family capability helper.
- Cover representative model IDs in unit tests.
- Gate request behavior and settings display with that helper.

Deliverable:

- Hada applies reasoning controls only where they make sense

### Phase 4: Settings UI

- Add persisted reasoning settings.
- Add `Thinking` toggle and `Thinking level` selector.
- Add concise explanatory copy tied to capability tier.

Deliverable:

- admins can configure OpenRouter reasoning from account settings

## Testing Strategy

### Provider Tests

- request body includes `reasoning.enabled` when expected
- request body includes `reasoning.effort` only when supported and configured
- stream parsing captures reasoning metadata without treating it as visible text
- non-stream parsing captures reasoning metadata correctly

### Agent Loop Tests

- preserved reasoning survives one or more tool turns
- reasoning metadata does not leak into `finalText`
- fallback parsing still works when a model emits plain visible content only

### Capability Tests

Cover at least:

- `x-ai/grok-4.1-fast`
- `deepseek/deepseek-v3.2`
- `qwen/qwen3.6-plus`
- `xiaomi/mimo-v2-omni`
- `minimax/minimax-m2.7`
- `z-ai/glm-5.1`
- `moonshotai/kimi-k2.5`

### Settings Tests

- persisted values load correctly into the settings form
- unsupported models hide thinking controls
- changing models updates the available controls without corrupting settings

## Risks

- OpenRouter model-family behavior may differ slightly across specific model IDs.
- DeepSeek preserved reasoning support may require empirical verification in Hada even if reasoning is accepted by the API.
- MiMo `omni` reasoning behavior may differ from `flash` or `pro` variants.
- GLM reasoning may work, but preserved reasoning continuity should not be assumed until tested.
- If reasoning payloads are large, they may increase context pressure and interact with compaction behavior.

## Open Decisions

- Whether unsupported or partially supported models should silently ignore saved reasoning settings or show a visible warning
- Whether effort controls should be exposed only for Grok first, then widened later
- Whether the capability helper should live purely as hardcoded prefix rules or merge live metadata from `/api/openrouter/models`

## Recommended Implementation Order

1. Provider request and parsing support in `providers.ts`
2. Runtime preserved reasoning support in `agent-loop.ts`
3. Capability helper in `src/lib/openrouter/reasoning.ts`
4. Database settings types
5. Account settings UI
6. Full test pass and model-family verification

## Success Criteria

- OpenRouter reasoning-enabled models can be invoked with `Thinking` enabled from settings.
- Preserved reasoning metadata survives tool-calling loops where supported.
- Visible chat output does not reveal raw chain-of-thought.
- Settings are capability-aware across Grok, DeepSeek, Qwen, MiMo, MiniMax, GLM, and Kimi families.
- Unsupported models do not receive invalid reasoning payloads.
