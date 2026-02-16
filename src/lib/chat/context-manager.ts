import type { SupabaseClient } from "@supabase/supabase-js";
import { callLLM, type LLMMessage, type ProviderSelection } from "@/lib/chat/providers";
import type { MessageMetadata } from "@/lib/types/database";

const DEFAULT_MAX_RECENT_MESSAGES = 50;
const DEFAULT_CONTEXT_TOKEN_BUDGET = 8_000;
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
}): Promise<ContextAssemblyResult> {
  const maxRecentMessages = options.maxRecentMessages ?? DEFAULT_MAX_RECENT_MESSAGES;
  const tokenBudget = options.tokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET;

  const [summaryResult, recentResult] = await Promise.all([
    options.supabase
      .from("messages")
      .select("content, metadata, created_at")
      .eq("conversation_id", options.conversationId)
      .order("created_at", { ascending: false })
      .limit(20),
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

  const summaries = summaryRows.filter(
    (message) => ((message.metadata || {}) as MessageMetadata).type === "compaction",
  );
  const latestSummary = summaries.length ? summaries[0].content : null;

  const rawMessages = recentRows.filter((message) => {
    const metadata = (message.metadata || {}) as MessageMetadata;
    return metadata.type !== "compaction";
  });

  // Keep messages chronological for the model.
  const chronological = rawMessages.reverse();

  const selected: LLMMessage[] = [];
  let usedTokens = 0;

  if (latestSummary) {
    selected.push({ role: "system", content: `Conversation summary: ${latestSummary}` });
    usedTokens += estimateTokens(latestSummary);
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

function fallbackSummary(lines: string[]): string {
  const text = lines.join("\n").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  return `Conversation summary: ${text.slice(0, 1200)}${text.length > 1200 ? "..." : ""}`;
}
