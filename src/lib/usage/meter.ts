import { AsyncLocalStorage } from "node:async_hooks";
import { createAdminClient } from "@/lib/supabase/server";
import type { UsageEventInsert, UsageKind, UsagePurpose } from "@/lib/types/database";

/**
 * Usage metering.
 *
 * Every call that spends platform money (LLM completion, embedding, web search)
 * calls `recordUsage`. Attribution comes from an AsyncLocalStorage context that
 * `processMessage` opens for the whole run, so nested and fire-and-forget work
 * (compaction, memory extraction, segment summaries, follow-ups) is attributed
 * to the right user without threading ids through every helper.
 *
 * Recording never throws into the caller: a missing table (migration 025 not
 * applied) or a DB hiccup only logs.
 */

export interface UsageContext {
  userId: string;
  agentRunId?: string | null;
  source?: string;
}

export interface UsageRecord {
  kind: UsageKind;
  purpose: UsagePurpose;
  provider?: string | null;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  costUsd?: number | null;
  estimated?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ParsedTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number | null;
}

type UsageWriter = (row: UsageEventInsert) => Promise<void>;

const storage = new AsyncLocalStorage<UsageContext>();

async function defaultWriter(row: UsageEventInsert): Promise<void> {
  const { error } = await createAdminClient().from("usage_events").insert(row);
  if (error) {
    console.error("Failed to record usage event:", error.message);
  }
}

let writer: UsageWriter = defaultWriter;

/** Test hook: replace the DB writer. Pass null to restore the default. */
export function setUsageWriterForTests(next: UsageWriter | null): void {
  writer = next ?? defaultWriter;
}

export function runWithUsageContext<T>(context: UsageContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getUsageContext(): UsageContext | undefined {
  return storage.getStore();
}

/** Attach the agent run id once it exists; later records in this run carry it. */
export function setUsageAgentRunId(agentRunId: string | null): void {
  const context = storage.getStore();
  if (context) {
    context.agentRunId = agentRunId;
  }
}

/**
 * Record one metered call. Returns a promise that never rejects; callers that
 * don't need to wait can `void` it.
 */
export function recordUsage(record: UsageRecord): Promise<void> {
  const context = storage.getStore();
  if (!context) {
    console.warn("[usage] recorded without a user context:", record.kind, record.purpose, record.model ?? "");
  }

  const row: UsageEventInsert = {
    user_id: context?.userId ?? null,
    agent_run_id: context?.agentRunId ?? null,
    kind: record.kind,
    purpose: record.purpose,
    provider: record.provider ?? null,
    model: record.model ?? null,
    input_tokens: toCount(record.inputTokens),
    output_tokens: toCount(record.outputTokens),
    cached_tokens: toCount(record.cachedTokens),
    cost_usd: typeof record.costUsd === "number" && Number.isFinite(record.costUsd) ? record.costUsd : null,
    estimated: record.estimated ?? false,
    metadata: {
      ...(context?.source ? { source: context.source } : {}),
      ...(record.metadata ?? {}),
    },
  };

  try {
    return writer(row).catch((error: unknown) => {
      console.error("Failed to record usage event:", error instanceof Error ? error.message : error);
    });
  } catch (error) {
    console.error("Failed to record usage event:", error instanceof Error ? error.message : error);
    return Promise.resolve();
  }
}

/** Rough token estimate (~4 chars per token) for when a provider reports nothing. */
export function estimateTokens(text: string): number {
  return text ? Math.ceil(text.length / 4) : 0;
}

/**
 * Normalise a provider `usage` object. Handles the OpenAI shape (also used by
 * OpenRouter, which adds `cost` in USD) and the Anthropic shape. Returns null
 * when the value carries no token counts.
 */
export function parseTokenUsage(raw: unknown): ParsedTokenUsage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const usage = raw as Record<string, unknown>;

  const openAIInput = num(usage.prompt_tokens);
  const openAIOutput = num(usage.completion_tokens);
  const anthropicInput = num(usage.input_tokens);
  const anthropicOutput = num(usage.output_tokens);

  if (openAIInput === null && openAIOutput === null && anthropicInput === null && anthropicOutput === null) {
    return null;
  }

  const promptDetails = usage.prompt_tokens_details;
  const openAICached =
    promptDetails && typeof promptDetails === "object"
      ? num((promptDetails as Record<string, unknown>).cached_tokens)
      : null;
  const anthropicCached = num(usage.cache_read_input_tokens);

  return {
    inputTokens: openAIInput ?? anthropicInput ?? 0,
    outputTokens: openAIOutput ?? anthropicOutput ?? 0,
    cachedTokens: openAICached ?? anthropicCached ?? 0,
    costUsd: num(usage.cost),
  };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
