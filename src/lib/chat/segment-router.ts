import type { SupabaseClient } from "@supabase/supabase-js";

// Local type definitions — will be moved to @/lib/types/database once migrations merge
export interface ConversationSegment {
  id: string;
  conversation_id: string;
  user_id: string;
  status: 'active' | 'closed' | 'archived';
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

export type SegmentSignal = 'continue' | 'new' | 'revive';

export interface SegmentSignalData {
  signal: SegmentSignal;
  topicKey?: string;
  title?: string;
}

export interface ContextHint {
  activeSegment: ConversationSegment | null;
  candidateSegments: ConversationSegment[];
  confidence: number;
  reason: string;
}

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","was","are","were","be","been","being","have","has","had","do","does","did",
  "will","would","could","should","may","might","shall","can","need","dare",
  "i","you","he","she","it","we","they","me","him","her","us","them",
  "my","your","his","its","our","their","this","that","these","those",
  "what","which","who","how","when","where","why","not","no","so","if","then",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let intersectionCount = 0;
  for (const word of a) {
    if (b.has(word)) intersectionCount++;
  }
  return intersectionCount / (a.size + b.size - intersectionCount);
}

function idleHours(lastActiveAt: string): number {
  return (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60);
}

function rankCandidates(
  segments: ConversationSegment[],
  messageTokens: Set<string>,
): ConversationSegment[] {
  const HALF_LIFE_DAYS = 7;
  const now = Date.now();

  const scored = segments.map(seg => {
    const segText = [seg.title ?? "", seg.summary ?? "", seg.topic_key ?? ""].join(" ");
    const segTokens = tokenize(segText);
    const keywordScore = jaccardSimilarity(messageTokens, segTokens);

    const ageDays = (now - new Date(seg.last_active_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

    const countScore = Math.log10(Math.max(seg.message_count, 1)) / 3;

    const total = keywordScore * 0.6 + recencyScore * 0.3 + countScore * 0.1;
    return { seg, total };
  });

  return scored
    .sort((a, b) => b.total - a.total)
    .map(s => s.seg);
}

export async function computeContextHint(options: {
  supabase: SupabaseClient;
  conversationId: string;
  userMessage: string;
}): Promise<ContextHint> {
  const { supabase, conversationId, userMessage } = options;

  const { data: activeSegmentData } = await supabase
    .from("conversation_segments")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .single();

  const activeSegment = activeSegmentData as ConversationSegment | null;
  const messageTokens = tokenize(userMessage);

  if (!activeSegment) {
    const { data: recentData } = await supabase
      .from("conversation_segments")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("status", "closed")
      .order("last_active_at", { ascending: false })
      .limit(5);

    const recent = (recentData as ConversationSegment[] | null) || [];
    const candidates = rankCandidates(recent, messageTokens).slice(0, 3);

    return {
      activeSegment: null,
      candidateSegments: candidates,
      confidence: 0,
      reason: "no_active_segment",
    };
  }

  const segmentText = [
    activeSegment.title ?? "",
    activeSegment.summary ?? "",
    activeSegment.topic_key ?? "",
  ].join(" ");
  const segmentTokens = tokenize(segmentText);
  const jaccard = jaccardSimilarity(messageTokens, segmentTokens);
  const idle = idleHours(activeSegment.last_active_at);

  let confidence: number;
  let reason: string;
  let candidateCount: number;

  if (jaccard > 0.3 && idle < 2) {
    confidence = 0.85;
    reason = `high_overlap_low_idle:jaccard=${jaccard.toFixed(2)},idle=${idle.toFixed(1)}h`;
    candidateCount = 0;
  } else if (jaccard >= 0.1 || idle <= 12) {
    confidence = 0.5;
    reason = `medium:jaccard=${jaccard.toFixed(2)},idle=${idle.toFixed(1)}h`;
    candidateCount = 2;
  } else {
    confidence = 0.15;
    reason = `low_overlap_long_idle:jaccard=${jaccard.toFixed(2)},idle=${idle.toFixed(1)}h`;
    candidateCount = 3;
  }

  let candidateSegments: ConversationSegment[] = [];
  if (candidateCount > 0) {
    const { data: closedData } = await supabase
      .from("conversation_segments")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("status", "closed")
      .order("last_active_at", { ascending: false })
      .limit(10);

    const closed = (closedData as ConversationSegment[] | null) || [];
    candidateSegments = rankCandidates(closed, messageTokens).slice(0, candidateCount);
  }

  return {
    activeSegment,
    candidateSegments,
    confidence,
    reason,
  };
}

async function attachMessagesToSegment(
  supabase: SupabaseClient,
  segmentId: string,
  messageIds: string[],
): Promise<void> {
  if (!messageIds.length) return;
  await supabase
    .from("messages")
    .update({ segment_id: segmentId })
    .in("id", messageIds);
}

async function createSegment(
  supabase: SupabaseClient,
  options: { conversationId: string; userId: string; topicKey: string; title: string | null },
): Promise<ConversationSegment | null> {
  const { data } = await supabase
    .from("conversation_segments")
    .insert({
      conversation_id: options.conversationId,
      user_id: options.userId,
      status: "active",
      topic_key: options.topicKey,
      title: options.title,
      opened_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      message_count: 0,
    })
    .select()
    .single();
  return data as ConversationSegment | null;
}

export async function persistSegmentDecision(options: {
  supabase: SupabaseClient;
  conversationId: string;
  userId: string;
  userMessageId: string;
  assistantMessageId: string;
  signal: SegmentSignalData | null;
  contextHint: ContextHint;
}): Promise<void> {
  const { supabase, conversationId, userId, userMessageId, assistantMessageId, signal, contextHint } = options;
  const activeSegment = contextHint.activeSegment;
  const effectiveSignal = signal?.signal ?? "continue";

  try {
    if (effectiveSignal === "continue" || !signal) {
      if (activeSegment) {
        await supabase
          .from("conversation_segments")
          .update({
            last_active_at: new Date().toISOString(),
            message_count: activeSegment.message_count + 2,
          })
          .eq("id", activeSegment.id);
        await attachMessagesToSegment(supabase, activeSegment.id, [userMessageId, assistantMessageId]);
      } else {
        const newSegment = await createSegment(supabase, {
          conversationId,
          userId,
          topicKey: "general",
          title: "General",
        });
        if (newSegment) {
          await attachMessagesToSegment(supabase, newSegment.id, [userMessageId, assistantMessageId]);
        }
      }
    } else if (effectiveSignal === "new") {
      if (activeSegment) {
        if (activeSegment.message_count < 3) {
          await supabase
            .from("conversation_segments")
            .update({ last_active_at: new Date().toISOString(), message_count: activeSegment.message_count + 2 })
            .eq("id", activeSegment.id);
          await attachMessagesToSegment(supabase, activeSegment.id, [userMessageId, assistantMessageId]);
          return;
        }
        await supabase
          .from("conversation_segments")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", activeSegment.id);
      }
      const newSegment = await createSegment(supabase, {
        conversationId,
        userId,
        topicKey: signal.topicKey ?? "topic",
        title: signal.title ?? null,
      });
      if (newSegment) {
        await attachMessagesToSegment(supabase, newSegment.id, [userMessageId, assistantMessageId]);
      }
    } else if (effectiveSignal === "revive") {
      if (activeSegment) {
        await supabase
          .from("conversation_segments")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", activeSegment.id);
      }
      const topicKey = signal.topicKey;
      if (topicKey) {
        const { data: target } = await supabase
          .from("conversation_segments")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("topic_key", topicKey)
          .eq("status", "closed")
          .order("last_active_at", { ascending: false })
          .limit(1)
          .single();
        if (target) {
          await supabase
            .from("conversation_segments")
            .update({ status: "active", closed_at: null, last_active_at: new Date().toISOString() })
            .eq("id", target.id);
          await attachMessagesToSegment(supabase, target.id, [userMessageId, assistantMessageId]);
          return;
        }
      }
      const newSegment = await createSegment(supabase, {
        conversationId,
        userId,
        topicKey: signal.topicKey ?? "revived",
        title: signal.title ?? null,
      });
      if (newSegment) {
        await attachMessagesToSegment(supabase, newSegment.id, [userMessageId, assistantMessageId]);
      }
    }
  } catch (error) {
    const isUniqueViolation = error instanceof Error &&
      (error.message.includes("unique") || error.message.includes("duplicate"));
    if (isUniqueViolation && activeSegment) {
      console.warn("Segment unique constraint violation — retrying as continue");
      await supabase
        .from("conversation_segments")
        .update({ last_active_at: new Date().toISOString(), message_count: activeSegment.message_count + 2 })
        .eq("id", activeSegment.id);
      await attachMessagesToSegment(supabase, activeSegment.id, [userMessageId, assistantMessageId]);
    } else {
      console.error("Segment persistence failed", error);
    }
  }
}
