import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/chat/embeddings";
import { callLLM, type LLMMessage, type ProviderSelection } from "@/lib/chat/providers";
import type { MessageMetadata } from "@/lib/types/database";

const DEFAULT_MAX_RECENT_MESSAGES = 50;
const DEFAULT_CONTEXT_TOKEN_BUDGET = 16_000;
const DEFAULT_COMPACTION_SUMMARY_TOKEN_BUDGET = 4_000;
const DEFAULT_MAX_COMPACTION_SUMMARIES = 4;
const COMPACTION_THRESHOLD = 200;

export interface ContextAssemblyResult {
  messages: LLMMessage[];
  estimatedTokens: number;
}

export async function assembleConversationContext(options: {
  supabase: SupabaseClient;
  conversationId: string;
  maxRecentMessages?: number;
  tokenBudget?: number;
  summaryTokenBudget?: number;
  maxCompactionSummaries?: number;
}): Promise<ContextAssemblyResult> {
  const maxRecentMessages = options.maxRecentMessages ?? DEFAULT_MAX_RECENT_MESSAGES;
  const tokenBudget = options.tokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET;
  const summaryTokenBudget =
    options.summaryTokenBudget ?? DEFAULT_COMPACTION_SUMMARY_TOKEN_BUDGET;
  const maxCompactionSummaries =
    options.maxCompactionSummaries ?? DEFAULT_MAX_COMPACTION_SUMMARIES;

  const [summaryResult, recentResult] = await Promise.all([
    options.supabase
      .from("messages")
      .select("content, metadata, created_at")
      .eq("conversation_id", options.conversationId)
      .contains("metadata", { type: "compaction" })
      .order("created_at", { ascending: false })
      .limit(Math.max(maxCompactionSummaries * 3, 12)),
    options.supabase
      .from("messages")
      .select("role, content, metadata, created_at")
      .eq("conversation_id", options.conversationId)
      .order("created_at", { ascending: false })
      .limit(maxRecentMessages * 3),
  ]);

  type ContextRow = {
    role: "user" | "assistant" | "system";
    content: string;
    metadata: MessageMetadata | null;
    created_at: string;
  };

  const summaryRows = (summaryResult.data as unknown as ContextRow[] | null) || [];
  const recentRows = (recentResult.data as unknown as ContextRow[] | null) || [];

  const summariesDescending = summaryRows.filter(
    (message) => ((message.metadata || {}) as MessageMetadata).type === "compaction",
  );
  const selectedSummariesDescending: ContextRow[] = [];
  let summaryTokens = 0;

  for (const summary of summariesDescending) {
    if (selectedSummariesDescending.length >= maxCompactionSummaries) {
      break;
    }

    const nextTokens = estimateTokens(summary.content);
    if (summaryTokens + nextTokens > summaryTokenBudget) {
      continue;
    }

    selectedSummariesDescending.push(summary);
    summaryTokens += nextTokens;
  }

  const layeredSummaries = selectedSummariesDescending.reverse();

  const rawMessages = recentRows.filter((message) => {
    const metadata = (message.metadata || {}) as MessageMetadata;
    return metadata.type !== "compaction";
  });

  // Keep messages chronological for the model.
  const chronological = rawMessages.reverse();

  const selected: LLMMessage[] = [];
  let usedTokens = 0;

  for (const [index, summary] of layeredSummaries.entries()) {
    selected.push({
      role: "system",
      content:
        layeredSummaries.length > 1
          ? `Conversation summary ${index + 1}/${layeredSummaries.length}: ${summary.content}`
          : `Conversation summary: ${summary.content}`,
    });
    usedTokens += estimateTokens(summary.content);
  }

  // Keep the newest history that fits the budget.
  for (let i = chronological.length - 1; i >= 0; i -= 1) {
    const message = chronological[i];
    const nextTokens = estimateTokens(message.content);
    if (usedTokens + nextTokens > tokenBudget) {
      continue;
    }

    selected.unshift({
      role: message.role,
      content: message.content,
    });
    usedTokens += nextTokens;
  }

  return {
    messages: selected,
    estimatedTokens: usedTokens,
  };
}

export async function maybeCompactConversation(options: {
  supabase: SupabaseClient;
  conversationId: string;
  provider: ProviderSelection;
  userId: string;
  compactAfterMessages?: number;
}): Promise<void> {
  const threshold = options.compactAfterMessages ?? COMPACTION_THRESHOLD;

  const { data: conversation } = await options.supabase
    .from("conversations")
    .select("compacted_through")
    .eq("id", options.conversationId)
    .single();

  const compactedThrough =
    (conversation as unknown as { compacted_through?: string | null } | null)?.compacted_through ||
    null;

  let countQuery = options.supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", options.conversationId);

  if (compactedThrough) {
    countQuery = countQuery.gt("created_at", compactedThrough);
  }

  const { count } = await countQuery;
  if ((count || 0) < threshold) {
    return;
  }

  let chunkQuery = options.supabase
    .from("messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", options.conversationId)
    .order("created_at", { ascending: true })
    .limit(120);

  if (compactedThrough) {
    chunkQuery = chunkQuery.gt("created_at", compactedThrough);
  }

  const { data: chunk } = await chunkQuery;
  type ChunkRow = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    metadata: MessageMetadata | null;
    created_at: string;
  };

  const chunkRows = (chunk as unknown as ChunkRow[] | null) || [];

  const sourceMessages = chunkRows.filter((message) => {
    const metadata = (message.metadata || {}) as MessageMetadata;
    return metadata.type !== "compaction" && (message.role === "user" || message.role === "assistant");
  });

  if (!sourceMessages.length) {
    return;
  }

  const transcript = sourceMessages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n")
    .slice(0, 20_000);

  await flushMemoriesBeforeCompaction({
    supabase: options.supabase,
    userId: options.userId,
    provider: options.provider,
    transcript,
  });

  let summary = "";
  try {
    const result = await callLLM({
      selection: options.provider,
      tools: [],
      messages: [
        {
          role: "system",
          content:
            "Summarize this chat history for future context. Capture durable facts, active threads, and commitments. Keep it concise.",
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    });
    summary = result.content.trim();
  } catch {
    summary = fallbackSummary(sourceMessages.map((m) => m.content));
  }

  if (!summary) {
    return;
  }

  await options.supabase.from("messages").insert({
    conversation_id: options.conversationId,
    role: "system",
    content: summary,
    metadata: { type: "compaction" },
  });

  await options.supabase
    .from("conversations")
    .update({ compacted_through: sourceMessages[sourceMessages.length - 1].created_at })
    .eq("id", options.conversationId);
}

export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

async function flushMemoriesBeforeCompaction(options: {
  supabase: SupabaseClient;
  userId: string;
  provider: ProviderSelection;
  transcript: string;
}): Promise<void> {
  if (!options.transcript.trim()) {
    return;
  }

  const { data: existing } = await options.supabase
    .from("user_memories")
    .select("topic, content")
    .eq("user_id", options.userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const existingMemories = (existing || []) as Array<{ topic: string; content: string }>;
  const existingSection = existingMemories.length
    ? existingMemories.map((memory) => `- ${memory.topic}: ${memory.content}`).join("\n")
    : "None yet.";

  let extraction = "";
  try {
    const result = await callLLM({
      selection: options.provider,
      tools: [],
      messages: [
        {
          role: "system",
          content: `You extract durable user facts from conversations. Output ONLY a JSON array of {topic, content} objects. Rules:
- Only extract stable user preferences, recurring constraints, identity facts, or long-term context.
- Do NOT extract research results, task outputs, one-off plans, or ephemeral information.
- Topics are short kebab-case keys (e.g. "work-hours", "coffee-preference").
- Content is 1-2 sentences max, plain text, no markdown.
- If a fact updates an existing memory, use the same topic key.
- If nothing durable is found, output an empty array: []

Existing memories:
${existingSection}`,
        },
        {
          role: "user",
          content: options.transcript,
        },
      ],
    });
    extraction = result.content.trim();
  } catch {
    return;
  }

  let memories: Array<{ topic: string; content: string }> = [];
  try {
    const jsonMatch = extraction.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) {
      return;
    }

    memories = parsed as Array<{ topic: string; content: string }>;
  } catch {
    return;
  }

  const toSave = memories
    .filter(
      (memory) =>
        typeof memory?.topic === "string" &&
        typeof memory?.content === "string" &&
        memory.topic.trim().length > 0 &&
        memory.content.trim().length > 0 &&
        memory.topic.trim().length <= 60 &&
        memory.content.trim().length <= 500,
    )
    .slice(0, 5);

  for (const memory of toSave) {
    const embedding = await generateEmbedding(`${memory.topic.trim()}: ${memory.content.trim()}`);
    await options.supabase.from("user_memories").upsert(
      {
        user_id: options.userId,
        topic: memory.topic.trim(),
        content: memory.content.trim(),
        embedding: embedding ? JSON.stringify(embedding) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic" },
    );
  }
}

function fallbackSummary(lines: string[]): string {
  const text = lines.join("\n").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  return `Conversation summary: ${text.slice(0, 1200)}${text.length > 1200 ? "..." : ""}`;
}

export function compactMessagesInPlace(
  messages: LLMMessage[],
  options: {
    tokenBudget: number;
    protectLastN: number;
    initialCount: number;
  },
): { compacted: boolean; removedCount: number } {
  const totalTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(typeof msg.content === "string" ? msg.content : ""),
    0,
  );

  if (totalTokens <= options.tokenBudget) {
    return { compacted: false, removedCount: 0 };
  }

  const trimStart = options.initialCount;
  const trimEnd = messages.length - options.protectLastN;

  if (trimEnd <= trimStart) {
    return { compacted: false, removedCount: 0 };
  }

  const compactable = messages.slice(trimStart, trimEnd).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const compactedSummary = compactable
    .map((m) => `${m.role}: ${(typeof m.content === "string" ? m.content : "").slice(0, 200)}`)
    .join("\n")
    .slice(0, 2000);

  const removedCount = trimEnd - trimStart;
  messages.splice(trimStart, removedCount, {
    role: "system",
    content: `[Context compacted: ${removedCount} messages summarized to stay within token budget]\n${compactedSummary}`,
  });

  return { compacted: true, removedCount };
}
