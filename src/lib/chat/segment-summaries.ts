import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/chat/embeddings";
import { callLLM, type ProviderSelection } from "@/lib/chat/providers";

const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GROWTH_REFRESH_THRESHOLD = 30;
const DEFAULT_FETCH_LIMIT = 120;
const DEFAULT_MAX_TRANSCRIPT_CHARS = 20_000;

export type SegmentSummaryRefreshReason = "closed" | "grown" | "revived" | "manual";

export interface ConversationSegmentSummaryRow {
  id: string;
  conversation_id: string;
  user_id: string;
  status: "active" | "closed" | "archived";
  title: string | null;
  summary: string | null;
  summary_embedding: string | null;
  topic_key: string | null;
  opened_at: string;
  closed_at: string | null;
  last_active_at: string;
  message_count: number;
  metadata: Record<string, unknown>;
}

export interface SegmentSummaryDecision {
  shouldRefresh: boolean;
  reason: string;
  stale: boolean;
  hasSummary: boolean;
  coveredMessageCount: number;
  newMessageCount: number;
}

export interface SegmentSummaryRefreshResult {
  refreshed: boolean;
  summary: string | null;
  embedding: number[] | null;
  reason: string;
  messageCount: number;
}

export async function queueSegmentSummaryRefresh(options: {
  supabase: SupabaseClient;
  provider: ProviderSelection;
  segmentId: string;
  reason?: SegmentSummaryRefreshReason;
  force?: boolean;
  staleAfterMs?: number;
  growthRefreshThreshold?: number;
  fetchLimit?: number;
  maxTranscriptChars?: number;
}): Promise<SegmentSummaryRefreshResult | null> {
  const segment = await loadSegment(options.supabase, options.segmentId);
  if (!segment) {
    return null;
  }

  const decision = shouldRefreshSegmentSummary(segment, {
    reason: options.reason ?? "manual",
    force: options.force ?? false,
    staleAfterMs: options.staleAfterMs,
    growthRefreshThreshold: options.growthRefreshThreshold,
  });

  if (!decision.shouldRefresh) {
    return {
      refreshed: false,
      summary: normalizeSummary(segment.summary),
      embedding: null,
      reason: decision.reason,
      messageCount: segment.message_count,
    };
  }

  return refreshSegmentSummary({
    supabase: options.supabase,
    provider: options.provider,
    segment,
    reason: options.reason ?? "manual",
    staleAfterMs: options.staleAfterMs,
    growthRefreshThreshold: options.growthRefreshThreshold,
    fetchLimit: options.fetchLimit,
    maxTranscriptChars: options.maxTranscriptChars,
  });
}

export function shouldRefreshSegmentSummary(
  segment: ConversationSegmentSummaryRow,
  options?: {
    reason?: SegmentSummaryRefreshReason;
    force?: boolean;
    staleAfterMs?: number;
    growthRefreshThreshold?: number;
    now?: number;
  },
): SegmentSummaryDecision {
  const reason = options?.reason ?? "manual";
  const force = options?.force ?? false;
  const staleAfterMs = options?.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const growthRefreshThreshold = options?.growthRefreshThreshold ?? DEFAULT_GROWTH_REFRESH_THRESHOLD;
  const now = options?.now ?? Date.now();

  const summaryRefreshedAt = getSummaryRefreshedAt(segment);
  const summaryMessageCount = getSummaryMessageCount(segment);
  const coveredMessageCount = summaryMessageCount ?? 0;
  const newMessageCount = Math.max(segment.message_count - coveredMessageCount, 0);
  const stale = !summaryRefreshedAt || now - summaryRefreshedAt > staleAfterMs;
  const hasSummary = Boolean(normalizeSummary(segment.summary));

  if (force) {
    return {
      shouldRefresh: true,
      reason: "forced",
      stale,
      hasSummary,
      coveredMessageCount,
      newMessageCount,
    };
  }

  if (reason === "closed") {
    return {
      shouldRefresh: true,
      reason: hasSummary ? (stale ? "closed_stale" : "closed_refresh") : "closed_new",
      stale,
      hasSummary,
      coveredMessageCount,
      newMessageCount,
    };
  }

  if (reason === "revived") {
    return {
      shouldRefresh: hasSummary ? stale || newMessageCount > 0 : true,
      reason: hasSummary ? (stale ? "revived_stale" : "revived_delta") : "revived_new",
      stale,
      hasSummary,
      coveredMessageCount,
      newMessageCount,
    };
  }

  if (newMessageCount >= growthRefreshThreshold) {
    return {
      shouldRefresh: true,
      reason: "grown",
      stale,
      hasSummary,
      coveredMessageCount,
      newMessageCount,
    };
  }

  if (!hasSummary) {
    return {
      shouldRefresh: true,
      reason: "missing_summary",
      stale,
      hasSummary,
      coveredMessageCount,
      newMessageCount,
    };
  }

  if (stale && newMessageCount > 0) {
    return {
      shouldRefresh: true,
      reason: "stale_with_new_messages",
      stale,
      hasSummary,
      coveredMessageCount,
      newMessageCount,
    };
  }

  return {
    shouldRefresh: false,
    reason: "fresh_enough",
    stale,
    hasSummary,
    coveredMessageCount,
    newMessageCount,
  };
}

export async function refreshSegmentSummary(options: {
  supabase: SupabaseClient;
  provider: ProviderSelection;
  segment: ConversationSegmentSummaryRow;
  reason?: SegmentSummaryRefreshReason;
  staleAfterMs?: number;
  growthRefreshThreshold?: number;
  fetchLimit?: number;
  maxTranscriptChars?: number;
}): Promise<SegmentSummaryRefreshResult | null> {
  const segment = options.segment;
  const reason = options.reason ?? "manual";
  const fetchLimit = options.fetchLimit ?? DEFAULT_FETCH_LIMIT;
  const maxTranscriptChars = options.maxTranscriptChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS;
  const decision = shouldRefreshSegmentSummary(segment, {
    reason,
    staleAfterMs: options.staleAfterMs,
    growthRefreshThreshold: options.growthRefreshThreshold,
  });

  if (!decision.shouldRefresh) {
    return {
      refreshed: false,
      summary: normalizeSummary(segment.summary),
      embedding: null,
      reason: decision.reason,
      messageCount: segment.message_count,
    };
  }

  const summaryState = getSummaryState(segment);
  const messages = await loadSegmentMessages(
    options.supabase,
    segment.id,
    summaryState.lastMessageAt,
    fetchLimit,
  );
  const transcriptMessages = messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );

  if (!transcriptMessages.length && normalizeSummary(segment.summary)) {
    await updateSegmentSummaryMetadata(options.supabase, segment, normalizeSummary(segment.summary) ?? "", null, {
      reason: decision.reason,
      refreshedAt: new Date().toISOString(),
      messageCount: segment.message_count,
      lastMessageAt: summaryState.lastMessageAt,
    });

    return {
      refreshed: false,
      summary: normalizeSummary(segment.summary),
      embedding: null,
      reason: decision.reason,
      messageCount: segment.message_count,
    };
  }

  const transcript = buildSegmentTranscript(transcriptMessages, maxTranscriptChars);
  const prompt = buildSummaryPrompt({
    reason,
    segment,
    existingSummary: normalizeSummary(segment.summary),
    transcript,
  });

  let summaryText = "";
  try {
    const result = await callLLM({
      selection: options.provider,
      tools: [],
      messages: prompt,
    });
    summaryText = normalizeSummary(result.content) ?? "";
  } catch {
    summaryText = fallbackSegmentSummary(transcriptMessages, normalizeSummary(segment.summary));
  }

  if (!summaryText) {
    return null;
  }

  let embedding: number[] | null = null;
  try {
    embedding = (await generateEmbedding(summaryText)) ?? null;
  } catch {
    embedding = null;
  }
  const lastMessageAt = transcriptMessages.at(-1)?.created_at ?? summaryState.lastMessageAt;
  const refreshedAt = new Date().toISOString();

  await updateSegmentSummaryMetadata(options.supabase, segment, summaryText, embedding, {
    reason: decision.reason,
    refreshedAt,
    messageCount: segment.message_count,
    lastMessageAt,
  });

  return {
    refreshed: true,
    summary: summaryText,
    embedding: embedding ?? null,
    reason: decision.reason,
    messageCount: segment.message_count,
  };
}

function buildSummaryPrompt(options: {
  reason: SegmentSummaryRefreshReason;
  segment: ConversationSegmentSummaryRow;
  existingSummary: string | null;
  transcript: string;
}): Array<{ role: "system" | "user"; content: string }> {
  const existingSummary = options.existingSummary
    ? `Existing summary:\n${options.existingSummary}`
    : "Existing summary: none.";

  return [
    {
      role: "system",
      content:
        "You summarize one internal chat segment for future retrieval. Preserve durable facts, decisions, open tasks, and references to saved artifacts. Keep it factual, compact, and self-contained. If an existing summary is provided, update it instead of repeating it verbatim.",
    },
    {
      role: "user",
      content: [
        `Reason: ${options.reason}`,
        `Segment topic: ${options.segment.topic_key ?? options.segment.title ?? "untitled"}`,
        existingSummary,
        "New messages:",
        options.transcript || "(no new messages)",
      ].join("\n\n"),
    },
  ];
}

function buildSegmentTranscript(
  messages: Array<{ role: string; content: string; created_at: string }>,
  maxChars: number,
): string {
  const lines: string[] = [];
  let totalChars = 0;

  for (const message of messages) {
    const line = `${message.role.toUpperCase()}: ${normalizeWhitespace(message.content)}`;
    if (!line.trim()) {
      continue;
    }

    if (totalChars + line.length > maxChars) {
      break;
    }

    lines.push(line);
    totalChars += line.length;
  }

  return lines.join("\n\n");
}

function fallbackSegmentSummary(
  messages: Array<{ role: string; content: string }>,
  existingSummary: string | null,
): string {
  const content = messages
    .map((message) => normalizeWhitespace(message.content))
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!content && existingSummary) {
    return existingSummary;
  }

  if (!content) {
    return "";
  }

  const prefix = existingSummary ? `${existingSummary} ` : "";
  return normalizeSummary(`${prefix}${content.slice(0, 1200)}${content.length > 1200 ? "..." : ""}`) ?? "";
}

async function loadSegment(
  supabase: SupabaseClient,
  segmentId: string,
): Promise<ConversationSegmentSummaryRow | null> {
  const { data, error } = await supabase
    .from("conversation_segments")
    .select("id, conversation_id, user_id, status, title, summary, summary_embedding, topic_key, opened_at, closed_at, last_active_at, message_count, metadata")
    .eq("id", segmentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as unknown as ConversationSegmentSummaryRow;
}

async function loadSegmentMessages(
  supabase: SupabaseClient,
  segmentId: string,
  after: string | null,
  limit: number,
): Promise<Array<{ role: "user" | "assistant" | "system"; content: string; created_at: string }>> {
  let query = supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("segment_id", segmentId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (after) {
    query = query.gt("created_at", after);
  }

  const { data } = await query;
  return (data as Array<{ role: "user" | "assistant" | "system"; content: string; created_at: string }> | null) ?? [];
}

async function updateSegmentSummaryMetadata(
  supabase: SupabaseClient,
  segment: ConversationSegmentSummaryRow,
  summary: string,
  embedding: number[] | null,
  options: {
    reason: string;
    refreshedAt: string;
    messageCount: number;
    lastMessageAt: string | null;
  },
): Promise<void> {
  const metadata = {
    ...(segment.metadata || {}),
    summary_refreshed_at: options.refreshedAt,
    summary_reason: options.reason,
    summary_message_count: options.messageCount,
    summary_last_message_at: options.lastMessageAt,
  };

  await supabase
    .from("conversation_segments")
    .update({
      summary,
      summary_embedding: embedding ? JSON.stringify(embedding) : null,
      metadata,
    })
    .eq("id", segment.id);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSummary(value: string | null | undefined): string | null {
  const text = normalizeWhitespace(value ?? "");
  return text.length ? text : null;
}

function getSummaryRefreshedAt(segment: ConversationSegmentSummaryRow): number | null {
  const metadata = segment.metadata || {};
  const raw = metadata.summary_refreshed_at;
  if (typeof raw !== "string") {
    return null;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSummaryMessageCount(segment: ConversationSegmentSummaryRow): number | null {
  const metadata = segment.metadata || {};
  const raw = metadata.summary_message_count;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }

  return Math.max(0, Math.floor(raw));
}

function getSummaryState(segment: ConversationSegmentSummaryRow): { lastMessageAt: string | null } {
  const metadata = segment.metadata || {};
  const raw = metadata.summary_last_message_at;
  return { lastMessageAt: typeof raw === "string" && raw.trim() ? raw : null };
}
