import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMMessage } from "@/lib/chat/providers";
import { isLongJobMessage } from "@/lib/chat/runtime-budgets";

const MIN_ARTIFACT_RESPONSE_CHARS = 2_000;
const MAX_ARTIFACT_TITLE_CHARS = 120;
const MAX_ARTIFACT_SUMMARY_CHARS = 520;
const MAX_ARTIFACT_CONTEXT_ITEMS = 4;
const MAX_ARTIFACT_CONTEXT_CHARS = 3_200;

export type SegmentArtifactKind = "memo" | "analysis" | "summary" | "other";

export interface SegmentArtifactRecord {
  id: string;
  segment_id: string;
  conversation_id: string;
  user_id: string;
  source_message_id: string | null;
  assistant_message_id: string | null;
  kind: SegmentArtifactKind;
  title: string;
  summary: string;
  content: string;
  summary_embedding: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SegmentArtifactCandidate {
  userId: string;
  conversationId: string;
  segmentId: string;
  triggeringMessage: string;
  assistantResponse: string;
  sourceMessageId?: string | null;
  assistantMessageId?: string | null;
  title?: string | null;
  kind?: SegmentArtifactKind;
  metadata?: Record<string, unknown>;
  summaryEmbedding?: number[] | null;
}

export interface RankedSegmentArtifact extends SegmentArtifactRecord {
  score: number;
  scoreReasons: string[];
}

export interface SegmentArtifactContextOptions {
  userMessage: string;
  activeSegmentId?: string | null;
  candidateSegmentIds?: string[];
  maxArtifacts?: number;
  maxContextChars?: number;
}

export function shouldPersistSegmentArtifact(options: {
  triggeringMessage: string;
  assistantResponse: string;
}): boolean {
  const triggeringMessage = normalizeWhitespace(options.triggeringMessage);
  const assistantResponse = normalizeWhitespace(options.assistantResponse);

  if (!triggeringMessage || !assistantResponse) {
    return false;
  }

  if (!isLongJobMessage(triggeringMessage)) {
    return false;
  }

  return assistantResponse.length >= MIN_ARTIFACT_RESPONSE_CHARS;
}

export function classifySegmentArtifactKind(options: {
  triggeringMessage: string;
  assistantResponse: string;
}): SegmentArtifactKind {
  const combined = `${options.triggeringMessage} ${options.assistantResponse}`.toLowerCase();

  if (/\bcompare\b|\bcomparison\b|\banalyze\b|\banalysis\b|\binvestigate\b/.test(combined)) {
    return "analysis";
  }

  if (/\brecommend\b|\brecommendation\b|\bplan\b|\bnext steps\b/.test(combined)) {
    return "memo";
  }

  if (/\bsummary\b/.test(combined)) {
    return "summary";
  }

  return "other";
}

export function deriveSegmentArtifactTitle(options: {
  triggeringMessage: string;
  assistantResponse: string;
  kind?: SegmentArtifactKind;
}): string {
  const explicitTitle = extractLeadingTitle(options.assistantResponse);
  if (explicitTitle) {
    return truncateTitle(explicitTitle);
  }

  const trigger = normalizeWhitespace(options.triggeringMessage);
  const triggerTitle = trigger
    .replace(/\b(write|create|draft|make|prepare|produce|analyze|compare|research|please)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (triggerTitle) {
    return truncateTitle(toTitleCase(triggerTitle));
  }

  const fallback = options.kind ? `${options.kind} artifact` : "Segment artifact";
  return truncateTitle(fallback);
}

export function buildSegmentArtifactSummary(options: {
  title?: string | null;
  assistantResponse: string;
  kind?: SegmentArtifactKind;
}): string {
  const content = normalizeArtifactContent(options.assistantResponse);
  if (!content) {
    return options.title ? truncateSummary(options.title) : "No summary available.";
  }

  const sections = splitArtifactSections(content);
  const title = options.title ? normalizeWhitespace(options.title) : "";
  const headline = extractLeadingTitle(content);
  const sentences = extractSentences(sections.plainText);
  const bullets = sections.bullets.slice(0, 3);
  const parts: string[] = [];

  if (title) {
    parts.push(title);
  } else if (headline) {
    parts.push(headline);
  }

  if (sentences.length > 0) {
    parts.push(sentences.slice(0, 3).join(" "));
  } else if (bullets.length > 0) {
    parts.push(bullets.join(" "));
  } else {
    parts.push(sections.plainText.slice(0, MAX_ARTIFACT_SUMMARY_CHARS));
  }

  if (sections.hasCode) {
    parts.push("Includes code or structured output.");
  }

  return truncateSummary(parts.filter(Boolean).join(" "));
}

export async function persistSegmentArtifact(
  supabase: SupabaseClient,
  candidate: SegmentArtifactCandidate,
): Promise<SegmentArtifactRecord | null> {
  if (!shouldPersistSegmentArtifact({
    triggeringMessage: candidate.triggeringMessage,
    assistantResponse: candidate.assistantResponse,
  })) {
    return null;
  }

  const kind = candidate.kind ?? classifySegmentArtifactKind(candidate);
  const title = truncateTitle(
    candidate.title?.trim() ||
      deriveSegmentArtifactTitle({
        triggeringMessage: candidate.triggeringMessage,
        assistantResponse: candidate.assistantResponse,
        kind,
      }),
  );
  const summary = truncateSummary(
    buildSegmentArtifactSummary({
      title,
      assistantResponse: candidate.assistantResponse,
      kind,
    }),
  );
  const content = normalizeArtifactContent(candidate.assistantResponse);
  const summaryEmbedding = candidate.summaryEmbedding ? JSON.stringify(candidate.summaryEmbedding) : null;

  const { data, error } = await supabase
    .from("segment_artifacts")
    .insert({
      segment_id: candidate.segmentId,
      conversation_id: candidate.conversationId,
      user_id: candidate.userId,
      source_message_id: candidate.sourceMessageId ?? null,
      assistant_message_id: candidate.assistantMessageId ?? null,
      kind,
      title,
      summary,
      content,
      summary_embedding: summaryEmbedding,
      metadata: {
        ...(candidate.metadata || {}),
        trigger: normalizeWhitespace(candidate.triggeringMessage).slice(0, 500),
      },
    })
    .select(
      "id, segment_id, conversation_id, user_id, source_message_id, assistant_message_id, kind, title, summary, content, summary_embedding, metadata, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    return null;
  }

  return data as SegmentArtifactRecord;
}

export async function listRelevantSegmentArtifacts(options: {
  supabase: SupabaseClient;
  userId: string;
  conversationId?: string;
  segmentIds?: string[];
  maxArtifacts?: number;
}): Promise<SegmentArtifactRecord[]> {
  const maxArtifacts = options.maxArtifacts ?? 20;
  let query = options.supabase
    .from("segment_artifacts")
    .select(
      "id, segment_id, conversation_id, user_id, source_message_id, assistant_message_id, kind, title, summary, content, summary_embedding, metadata, created_at, updated_at",
    )
    .eq("user_id", options.userId)
    .order("created_at", { ascending: false })
    .limit(Math.max(maxArtifacts * 3, 30));

  if (options.segmentIds?.length) {
    query = query.in("segment_id", options.segmentIds);
  } else if (options.conversationId) {
    query = query.eq("conversation_id", options.conversationId);
  }

  const { data, error } = await query;
  if (error) {
    return [];
  }

  return (data ?? []) as SegmentArtifactRecord[];
}

export function rankSegmentArtifacts(
  artifacts: SegmentArtifactRecord[],
  options: SegmentArtifactContextOptions,
): RankedSegmentArtifact[] {
  const queryTokens = tokenize(options.userMessage);
  const candidateSegmentIds = new Set((options.candidateSegmentIds ?? []).filter(Boolean));
  const activeSegmentId = options.activeSegmentId ?? null;

  return artifacts
    .map((artifact) => {
      const text = [
        artifact.title,
        artifact.summary,
        artifact.kind,
        String(artifact.metadata?.topic_key ?? ""),
      ]
        .join(" ")
        .trim();
      const artifactTokens = tokenize(text);
      const overlap = jaccardSimilarity(queryTokens, artifactTokens);
      const recency = recencyScore(artifact.created_at);
      const activeBoost = activeSegmentId && artifact.segment_id === activeSegmentId ? 0.45 : 0;
      const candidateBoost = candidateSegmentIds.has(artifact.segment_id) ? 0.2 : 0;
      const summaryBoost = artifact.summary.length > 0 ? 0.05 : 0;
      const score =
        overlap * 0.6 + recency * 0.2 + activeBoost + candidateBoost + summaryBoost;

      const scoreReasons = [
        activeBoost ? "active-segment" : null,
        candidateBoost ? "candidate-segment" : null,
        overlap > 0 ? `keyword-overlap:${overlap.toFixed(2)}` : null,
        recency > 0 ? `recency:${recency.toFixed(2)}` : null,
      ].filter(Boolean) as string[];

      return { ...artifact, score, scoreReasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildSegmentArtifactContextMessages(
  artifacts: SegmentArtifactRecord[],
  options: SegmentArtifactContextOptions,
): LLMMessage[] {
  const ranked = rankSegmentArtifacts(artifacts, options).slice(
    0,
    options.maxArtifacts ?? MAX_ARTIFACT_CONTEXT_ITEMS,
  );

  if (!ranked.length) {
    return [];
  }

  const maxChars = options.maxContextChars ?? MAX_ARTIFACT_CONTEXT_CHARS;
  const lines: string[] = [];
  let usedChars = 0;

  for (const artifact of ranked) {
    const block = renderArtifactBlock(artifact);
    if (usedChars + block.length > maxChars) {
      continue;
    }

    lines.push(block);
    usedChars += block.length;
  }

  if (!lines.length) {
    return [];
  }

  return [
    {
      role: "system",
      content: [
        "Relevant segment artifacts:",
        ...lines.map((line) => `- ${line}`),
        "Use these summaries instead of replaying the full underlying transcript unless the user explicitly asks for the source material.",
      ].join("\n"),
    },
  ];
}

function renderArtifactBlock(artifact: RankedSegmentArtifact): string {
  const details = [
    artifact.title,
    `kind=${artifact.kind}`,
    `segment=${artifact.segment_id}`,
    `summary=${artifact.summary}`,
  ];

  return details.join(" | ");
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeWhitespace(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) {
      intersection += 1;
    }
  }

  return intersection / (a.size + b.size - intersection);
}

function recencyScore(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - created) / (1000 * 60 * 60 * 24));
  const halfLifeDays = 14;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function normalizeArtifactContent(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/`[^`]+`/g, " ").replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim();
}

function splitArtifactSections(content: string): {
  plainText: string;
  bullets: string[];
  hasCode: boolean;
} {
  const bullets: string[] = [];
  let hasCode = false;
  let inCodeBlock = false;
  const plainLines: string[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("```")) {
      hasCode = true;
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    if (/^(?:[-*]|\d+\.)\s+/.test(line)) {
      bullets.push(line.replace(/^(?:[-*]|\d+\.)\s+/, ""));
      plainLines.push(line.replace(/^(?:[-*]|\d+\.)\s+/, ""));
      continue;
    }

    if (/^#+\s+/.test(line)) {
      plainLines.push(line.replace(/^#+\s+/, ""));
      continue;
    }

    plainLines.push(line);
  }

  return {
    plainText: normalizeWhitespace(plainLines.join(" ")),
    bullets,
    hasCode,
  };
}

function extractSentences(text: string): string[] {
  const matches = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  return matches.slice(0, 3);
}

function extractLeadingTitle(text: string): string | null {
  const normalized = text.replace(/\r\n/g, "\n");
  const headingMatch = normalized.match(/^\s*#+\s+(.+?)\s*$/m);
  if (headingMatch?.[1]) {
    return normalizeWhitespace(headingMatch[1]);
  }

  const firstLine = normalized
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .find(Boolean);

  if (!firstLine) {
    return null;
  }

  return firstLine.length > 140 ? firstLine.slice(0, 140).trimEnd() : firstLine;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function truncateTitle(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= MAX_ARTIFACT_TITLE_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_ARTIFACT_TITLE_CHARS - 3).trimEnd()}...`;
}

function truncateSummary(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= MAX_ARTIFACT_SUMMARY_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_ARTIFACT_SUMMARY_CHARS - 3).trimEnd()}...`;
}

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
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "shall",
  "she",
  "should",
  "so",
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
  "will",
  "with",
  "would",
  "you",
  "your",
]);
