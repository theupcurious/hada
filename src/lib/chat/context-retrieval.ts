import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMMessage } from "@/lib/chat/providers";
import { buildSegmentArtifactContextMessages, listRelevantSegmentArtifacts } from "@/lib/chat/segment-artifacts";
import type { ContextHint } from "@/lib/chat/segment-router";
import type { ConversationSegment, MemoryKind, MessageMetadata, UserMemory } from "@/lib/types/database";

export type RetrievalSource =
  | "active_summary"
  | "active_recent"
  | "profile_memory"
  | "project_memory"
  | "preference_memory"
  | "older_segment_summary"
  | "archive_memory"
  | "segment_artifact";

export interface ContextRetrievalCandidate {
  id: string;
  source: RetrievalSource;
  content: string;
  role?: LLMMessage["role"];
  title?: string | null;
  topicKey?: string | null;
  kind?: MemoryKind;
  pinned?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActiveAt?: string | null;
  messageCount?: number | null;
  segmentId?: string | null;
  embedding?: number[] | string | null;
}

export interface SourceBudgetStats {
  available: number;
  selected: number;
  tokens: number;
}

export interface ContextRetrievalSelection {
  id: string;
  source: RetrievalSource;
  score: number;
  tokenCount: number;
  selected: boolean;
  reasons: string[];
  preview: string;
}

export interface ContextRetrievalResult {
  messages: LLMMessage[];
  estimatedTokens: number;
  selections: ContextRetrievalSelection[];
  sourceBreakdown: Record<RetrievalSource, SourceBudgetStats>;
  strategy: "ranked";
}

export interface AssembleRankedContextOptions {
  userMessage: string;
  candidates: ContextRetrievalCandidate[];
  tokenBudget?: number;
  queryEmbedding?: number[] | null;
  sourceBudgets?: Partial<Record<RetrievalSource, number>>;
}

export interface RetrieveRankedConversationContextOptions {
  supabase: SupabaseClient;
  conversationId: string;
  userId: string;
  userMessage: string;
  contextHint: ContextHint;
  tokenBudget?: number;
  maxActiveRecentMessages?: number;
  maxMemoryRows?: number;
  maxArtifactRows?: number;
}

export interface MergeRecentConversationWindowOptions {
  rankedMessages: LLMMessage[];
  legacyMessages: LLMMessage[];
  maxRecentMessages?: number;
}

const DEFAULT_TOKEN_BUDGET = 16_000;
const DEFAULT_HALF_LIFE_DAYS = 7;

const DEFAULT_SOURCE_BUDGET_SHARES: Record<RetrievalSource, number> = {
  active_summary: 0.12,
  active_recent: 0.3,
  profile_memory: 0.15,
  project_memory: 0.16,
  preference_memory: 0.08,
  older_segment_summary: 0.12,
  archive_memory: 0.07,
  segment_artifact: 0.1,
};

const SOURCE_PRIORITY: RetrievalSource[] = [
  "active_summary",
  "active_recent",
  "profile_memory",
  "project_memory",
  "preference_memory",
  "older_segment_summary",
  "segment_artifact",
  "archive_memory",
];

const SOURCE_BASE_WEIGHT: Record<RetrievalSource, number> = {
  active_summary: 7_000,
  active_recent: 6_500,
  profile_memory: 5_500,
  project_memory: 4_800,
  preference_memory: 4_200,
  older_segment_summary: 3_600,
  segment_artifact: 3_400,
  archive_memory: 3_000,
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "she",
  "so",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

export function assembleRankedContext(options: AssembleRankedContextOptions): ContextRetrievalResult {
  const tokenBudget = Math.max(0, options.tokenBudget ?? DEFAULT_TOKEN_BUDGET);
  const queryTokens = tokenize(options.userMessage);
  const sourceBudgets = buildSourceBudgets(tokenBudget, options.sourceBudgets);
  const sourceBreakdown: Record<RetrievalSource, SourceBudgetStats> = {
    active_summary: { available: 0, selected: 0, tokens: 0 },
    active_recent: { available: 0, selected: 0, tokens: 0 },
    profile_memory: { available: 0, selected: 0, tokens: 0 },
    project_memory: { available: 0, selected: 0, tokens: 0 },
    preference_memory: { available: 0, selected: 0, tokens: 0 },
    older_segment_summary: { available: 0, selected: 0, tokens: 0 },
    segment_artifact: { available: 0, selected: 0, tokens: 0 },
    archive_memory: { available: 0, selected: 0, tokens: 0 },
  };

  const validCandidates = options.candidates
    .map((candidate) => normalizeCandidate(candidate))
    .filter((candidate): candidate is ContextRetrievalCandidate => candidate !== null);

  for (const candidate of validCandidates) {
    sourceBreakdown[candidate.source].available += 1;
  }

  const selections: ContextRetrievalSelection[] = [];
  const messages: LLMMessage[] = [];
  let estimatedTokens = 0;

  for (const source of SOURCE_PRIORITY) {
    const groupCandidates = validCandidates
      .filter((candidate) => candidate.source === source)
      .map((candidate) => {
        const score = scoreCandidate(candidate, queryTokens, options.queryEmbedding ?? null);
        const tokenCount = estimateTokens(formatCandidateContent(candidate));

        return {
          candidate,
          score,
          tokenCount,
        };
      })
      .sort((left, right) => {
        if (right.score.total !== left.score.total) {
          return right.score.total - left.score.total;
        }

        const leftDate = candidateSortDate(left.candidate);
        const rightDate = candidateSortDate(right.candidate);
        if (leftDate !== rightDate) {
          return rightDate - leftDate;
        }

        return left.candidate.id.localeCompare(right.candidate.id);
      });

    const sourceBudget = Math.min(sourceBudgets[source], tokenBudget - estimatedTokens);
    let sourceTokens = 0;
    let sourceSelected = 0;
    const selectedEntries: Array<{
      candidate: ContextRetrievalCandidate;
      score: { total: number; reasons: string[] };
      tokenCount: number;
    }> = [];

    for (const entry of groupCandidates) {
      const selected = sourceTokens + entry.tokenCount <= sourceBudget && estimatedTokens + entry.tokenCount <= tokenBudget;
      const reasons = [...entry.score.reasons, `source:${source}`];

      selections.push({
        id: entry.candidate.id,
        source,
        score: entry.score.total,
        tokenCount: entry.tokenCount,
        selected,
        reasons,
        preview: previewText(formatCandidateContent(entry.candidate)),
      });

      if (!selected) {
        continue;
      }

      sourceTokens += entry.tokenCount;
      estimatedTokens += entry.tokenCount;
      sourceSelected += 1;
      selectedEntries.push(entry);
    }

    if (source === "active_recent") {
      selectedEntries.sort((left, right) => {
        const leftDate = candidateSortDate(left.candidate);
        const rightDate = candidateSortDate(right.candidate);
        if (leftDate !== rightDate) {
          return leftDate - rightDate;
        }

        return left.candidate.id.localeCompare(right.candidate.id);
      });
    }

    for (const entry of selectedEntries) {
      messages.push(candidateToMessage(entry.candidate));
    }

    sourceBreakdown[source].selected = sourceSelected;
    sourceBreakdown[source].tokens = sourceTokens;
  }

  return {
    messages,
    estimatedTokens,
    selections,
    sourceBreakdown,
    strategy: "ranked",
  };
}

export function mergeRecentConversationWindow(
  options: MergeRecentConversationWindowOptions,
): LLMMessage[] {
  const maxRecentMessages = Math.max(0, options.maxRecentMessages ?? 4);
  if (maxRecentMessages === 0) {
    return options.rankedMessages;
  }

  const liveWindow = options.legacyMessages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-maxRecentMessages);

  if (!liveWindow.length) {
    return options.rankedMessages;
  }

  const liveWindowCounts = new Map<string, number>();
  for (const message of liveWindow) {
    const key = messageKey(message);
    liveWindowCounts.set(key, (liveWindowCounts.get(key) ?? 0) + 1);
  }

  const preservedPrefix: LLMMessage[] = [];
  for (const message of options.rankedMessages) {
    if (message.role !== "user" && message.role !== "assistant") {
      preservedPrefix.push(message);
      continue;
    }

    const key = messageKey(message);
    const overlapCount = liveWindowCounts.get(key) ?? 0;
    if (overlapCount > 0) {
      liveWindowCounts.set(key, overlapCount - 1);
      continue;
    }

    preservedPrefix.push(message);
  }

  return [...preservedPrefix, ...liveWindow];
}

export async function retrieveRankedConversationContext(
  options: RetrieveRankedConversationContextOptions,
): Promise<ContextRetrievalResult> {
  const activeSegment = options.contextHint.activeSegment;
  const candidateSegments = options.contextHint.candidateSegments;
  const segmentIds = [activeSegment?.id, ...candidateSegments.map((segment) => segment.id)].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  const maxActiveRecentMessages = options.maxActiveRecentMessages ?? 24;
  const maxMemoryRows = options.maxMemoryRows ?? 60;

  const [activeRecentResult, memoryResult, artifactRows] = await Promise.all([
    activeSegment
      ? options.supabase
          .from("messages")
          .select("id, role, content, metadata, created_at")
          .eq("segment_id", activeSegment.id)
          .order("created_at", { ascending: false })
          .limit(maxActiveRecentMessages)
      : Promise.resolve({ data: [] }),
    options.supabase
      .from("user_memories")
      .select("id, topic, content, updated_at, kind, pinned, embedding, source_segment_id")
      .eq("user_id", options.userId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(maxMemoryRows),
    listRelevantSegmentArtifacts({
      supabase: options.supabase,
      userId: options.userId,
      conversationId: options.conversationId,
      segmentIds,
      maxArtifacts: options.maxArtifactRows ?? 12,
    }),
  ]);

  const candidates: ContextRetrievalCandidate[] = [];
  const activeSummaryCandidate = toActiveSummaryCandidate(activeSegment);
  if (activeSummaryCandidate) {
    candidates.push(activeSummaryCandidate);
  }

  const activeRecentRows =
    ((activeRecentResult as { data?: Array<{
      id: string;
      role: LLMMessage["role"];
      content: string;
      metadata?: MessageMetadata | null;
      created_at: string;
    }> | null }).data ?? [])
      .filter((row) => row.role === "user" || row.role === "assistant")
      .filter((row) => ((row.metadata || {}) as MessageMetadata).type !== "compaction");

  for (const row of activeRecentRows) {
    candidates.push({
      id: row.id,
      source: "active_recent",
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      segmentId: activeSegment?.id ?? null,
    });
  }

  for (const segment of candidateSegments) {
    const candidate = toOlderSegmentCandidate(segment);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const memories = ((memoryResult.data as UserMemory[] | null) ?? []);
  const relevantSegmentIds = new Set(segmentIds);
  for (const memory of memories) {
    if (!shouldConsiderMemory(memory, relevantSegmentIds)) {
      continue;
    }

    candidates.push({
      id: memory.id,
      source: memorySourceForKind(memory.kind, memory.pinned),
      content: memory.content,
      title: memory.topic,
      topicKey: memory.source_segment_id,
      kind: memory.kind,
      pinned: memory.pinned,
      updatedAt: memory.updated_at,
      segmentId: memory.source_segment_id,
      embedding: memory.embedding,
    });
  }

  for (const artifactMessage of buildSegmentArtifactContextMessages(artifactRows, {
    userMessage: options.userMessage,
    activeSegmentId: activeSegment?.id ?? null,
    candidateSegmentIds: candidateSegments.map((segment) => segment.id),
    maxArtifacts: options.maxArtifactRows ?? 4,
  })) {
    candidates.push({
      id: `artifact:${candidates.length}`,
      source: "segment_artifact",
      content: artifactMessage.content,
      role: artifactMessage.role,
      segmentId: activeSegment?.id ?? null,
    });
  }

  return assembleRankedContext({
    userMessage: options.userMessage,
    candidates,
    tokenBudget: options.tokenBudget,
  });
}

export function scoreCandidate(
  candidate: ContextRetrievalCandidate,
  queryTokens: Set<string>,
  queryEmbedding: number[] | null,
): { total: number; reasons: string[] } {
  const reasons: string[] = [];
  const sourceWeight = SOURCE_BASE_WEIGHT[candidate.source];
  let total = sourceWeight;

  reasons.push(`source-weight:${candidate.source}:${sourceWeight}`);

  const candidateTokens = tokenize(candidateSearchText(candidate));
  const keywordSimilarity = jaccardSimilarity(queryTokens, candidateTokens);
  const keywordScore = Math.round(keywordSimilarity * 1_000);
  total += keywordScore;
  reasons.push(`keyword-overlap:${keywordSimilarity.toFixed(3)}`);

  const recencyScore = recencyScoreForCandidate(candidate);
  total += recencyScore;
  reasons.push(`recency:${(recencyScore / 100).toFixed(3)}`);

  if (candidate.pinned) {
    total += 250;
    reasons.push("pinned");
  }

  if (candidate.source === "active_summary" || candidate.source === "active_recent") {
    total += 150;
    reasons.push("active-segment");
  }

  const semanticSimilarity = semanticSimilarityScore(queryEmbedding, candidate.embedding);
  if (semanticSimilarity !== null) {
    const semanticScore = Math.round(semanticSimilarity * 800);
    total += semanticScore;
    reasons.push(`semantic-similarity:${semanticSimilarity.toFixed(3)}`);
  }

  const densityScore = candidate.messageCount
    ? Math.min(120, Math.round(Math.log10(Math.max(candidate.messageCount, 1)) * 60))
    : 0;
  if (densityScore > 0) {
    total += densityScore;
    reasons.push(`message-count:${candidate.messageCount}`);
  }

  return {
    total,
    reasons,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

export function memorySourceForKind(kind: MemoryKind | null | undefined, pinned = false): RetrievalSource {
  if (pinned) {
    return "profile_memory";
  }

  switch (kind) {
    case "project":
      return "project_memory";
    case "preference":
      return "preference_memory";
    case "archive":
      return "archive_memory";
    case "profile":
    default:
      return "profile_memory";
  }
}

function shouldConsiderMemory(memory: UserMemory, relevantSegmentIds: Set<string>): boolean {
  if (memory.pinned) {
    return true;
  }

  if (memory.kind === "profile") {
    return true;
  }

  if (memory.source_segment_id && relevantSegmentIds.has(memory.source_segment_id)) {
    return true;
  }

  return memory.kind !== "archive";
}

function toActiveSummaryCandidate(segment: ConversationSegment | null): ContextRetrievalCandidate | null {
  if (!segment?.summary) {
    return null;
  }

  return {
    id: `segment-summary:${segment.id}`,
    source: "active_summary",
    content: segment.summary,
    title: segment.title,
    topicKey: segment.topic_key,
    lastActiveAt: segment.last_active_at,
    messageCount: segment.message_count,
    segmentId: segment.id,
    embedding: segment.summary_embedding,
  };
}

function toOlderSegmentCandidate(segment: ConversationSegment): ContextRetrievalCandidate | null {
  if (!segment.summary) {
    return null;
  }

  return {
    id: `older-segment-summary:${segment.id}`,
    source: "older_segment_summary",
    content: segment.summary,
    title: segment.title,
    topicKey: segment.topic_key,
    lastActiveAt: segment.last_active_at,
    messageCount: segment.message_count,
    segmentId: segment.id,
    embedding: segment.summary_embedding,
  };
}

function buildSourceBudgets(
  tokenBudget: number,
  overrides?: Partial<Record<RetrievalSource, number>>,
): Record<RetrievalSource, number> {
  const result = {} as Record<RetrievalSource, number>;

  for (const source of SOURCE_PRIORITY) {
    const override = overrides?.[source];
    if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
      result[source] = Math.floor(override);
      continue;
    }

    result[source] = Math.max(1, Math.floor(tokenBudget * DEFAULT_SOURCE_BUDGET_SHARES[source]));
  }

  return result;
}

function normalizeCandidate(candidate: ContextRetrievalCandidate): ContextRetrievalCandidate | null {
  const content = normalizeText(candidate.content);
  if (!content) {
    return null;
  }

  return {
    ...candidate,
    content,
    title: candidate.title ? normalizeText(candidate.title) : candidate.title,
    topicKey: candidate.topicKey ? normalizeText(candidate.topicKey) : candidate.topicKey,
  };
}

function messageKey(message: LLMMessage): string {
  return `${message.role}\u0000${message.content}`;
}

function candidateToMessage(candidate: ContextRetrievalCandidate): LLMMessage {
  if (candidate.source === "active_recent") {
    return {
      role: candidate.role ?? "user",
      content: candidate.content,
    };
  }

  return {
    role: "system",
    content: formatCandidatePrompt(candidate),
  };
}

function formatCandidatePrompt(candidate: ContextRetrievalCandidate): string {
  switch (candidate.source) {
    case "active_summary":
      return candidate.title
        ? `Active segment summary (${candidate.title}): ${candidate.content}`
        : `Active segment summary: ${candidate.content}`;
    case "profile_memory":
      return formatMemoryPrompt("Pinned profile memory", candidate);
    case "project_memory":
      return formatMemoryPrompt("Project memory", candidate);
    case "preference_memory":
      return formatMemoryPrompt("Preference memory", candidate);
    case "archive_memory":
      return formatMemoryPrompt("Archive memory", candidate);
    case "segment_artifact":
      return `Relevant segment artifact: ${candidate.content}`;
    case "older_segment_summary":
      return candidate.title || candidate.topicKey
        ? `Older segment summary (${candidate.title || candidate.topicKey}): ${candidate.content}`
        : `Older segment summary: ${candidate.content}`;
    case "active_recent":
    default:
      return candidate.content;
  }
}

function formatMemoryPrompt(prefix: string, candidate: ContextRetrievalCandidate): string {
  const labelBits = [candidate.title, candidate.topicKey].filter(Boolean);
  const label = labelBits.length ? ` (${labelBits.join(" / ")})` : "";
  return `${prefix}${label}: ${candidate.content}`;
}

function candidateSearchText(candidate: ContextRetrievalCandidate): string {
  return [candidate.title, candidate.topicKey, candidate.content].filter(Boolean).join(" ");
}

function formatCandidateContent(candidate: ContextRetrievalCandidate): string {
  return candidateToMessage(candidate).content;
}

function previewText(text: string, maxChars = 120): string {
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 1)}…`;
}

function normalizeText(text: string): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (!left.size && !right.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function recencyScoreForCandidate(candidate: ContextRetrievalCandidate): number {
  const dateText = candidate.lastActiveAt || candidate.updatedAt || candidate.createdAt || null;
  if (!dateText) {
    return 0;
  }

  const timestamp = new Date(dateText).getTime();
  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  const decay = Math.pow(0.5, ageDays / DEFAULT_HALF_LIFE_DAYS);
  return Math.round(decay * 100);
}

function semanticSimilarityScore(
  queryEmbedding: number[] | null,
  candidateEmbedding: number[] | string | null | undefined,
): number | null {
  if (!queryEmbedding || !queryEmbedding.length || candidateEmbedding == null) {
    return null;
  }

  const parsed = parseEmbedding(candidateEmbedding);
  if (!parsed || parsed.length !== queryEmbedding.length) {
    return null;
  }

  const score = cosineSimilarity(queryEmbedding, parsed);
  return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : null;
}

function parseEmbedding(value: number[] | string): number[] | null {
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === "number" && Number.isFinite(entry)) ? value : null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const numeric = parsed.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
    return numeric.length === parsed.length ? numeric : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function candidateSortDate(candidate: ContextRetrievalCandidate): number {
  const dateText = candidate.lastActiveAt || candidate.updatedAt || candidate.createdAt || null;
  if (!dateText) {
    return 0;
  }

  const timestamp = new Date(dateText).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
