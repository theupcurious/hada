import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationSegment } from "@/lib/types/database";

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

export interface PersistSegmentDecisionResult {
  signal: SegmentSignal;
  action: "continue" | "create" | "revive" | "fallback";
  segmentId: string | null;
  closedSegmentId: string | null;
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
  const { error } = await supabase
    .from("messages")
    .update({ segment_id: segmentId })
    .in("id", messageIds);
  if (error) {
    throw new Error(`Failed to attach messages to segment ${segmentId}: ${error.message}`);
  }
}

async function createSegment(
  supabase: SupabaseClient,
  options: {
    conversationId: string;
    userId: string;
    topicKey: string;
    title: string | null;
    nowIso: string;
    messageCount?: number;
  },
): Promise<ConversationSegment | null> {
  const { data, error } = await supabase
    .from("conversation_segments")
    .insert({
      conversation_id: options.conversationId,
      user_id: options.userId,
      status: "active",
      topic_key: options.topicKey,
      title: options.title,
      opened_at: options.nowIso,
      last_active_at: options.nowIso,
      message_count: options.messageCount ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create segment: ${error.message}`);
  }

  return data as ConversationSegment | null;
}

async function fetchActiveSegment(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationSegment | null> {
  const { data, error } = await supabase
    .from("conversation_segments")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .single();

  if (error && !error.message.toLowerCase().includes("no rows")) {
    throw new Error(`Failed to fetch active segment: ${error.message}`);
  }

  return (data as ConversationSegment | null) ?? null;
}

async function updateSegment(
  supabase: SupabaseClient,
  segmentId: string,
  patch: Partial<ConversationSegment>,
): Promise<void> {
  const { error } = await supabase
    .from("conversation_segments")
    .update(patch)
    .eq("id", segmentId);

  if (error) {
    throw new Error(`Failed to update segment ${segmentId}: ${error.message}`);
  }
}

async function continueSegment(
  supabase: SupabaseClient,
  segment: ConversationSegment,
  options: {
    nowIso: string;
    userMessageId: string;
    assistantMessageId: string;
    signal?: PersistSegmentDecisionResult["signal"];
    action?: PersistSegmentDecisionResult["action"];
    closedSegmentId?: string | null;
  },
): Promise<PersistSegmentDecisionResult> {
  await updateSegment(supabase, segment.id, {
    status: "active",
    closed_at: null,
    last_active_at: options.nowIso,
    message_count: segment.message_count + 2,
  });
  await attachMessagesToSegment(supabase, segment.id, [options.userMessageId, options.assistantMessageId]);

  return {
    signal: options.signal ?? "continue",
    action: options.action ?? "continue",
    segmentId: segment.id,
    closedSegmentId: options.closedSegmentId ?? null,
  };
}

async function rollbackToActiveSegment(
  supabase: SupabaseClient,
  conversationId: string,
  previousActiveSegment: ConversationSegment | null,
  options: {
    nowIso: string;
    userMessageId: string;
    assistantMessageId: string;
  },
): Promise<PersistSegmentDecisionResult | null> {
  const currentActiveSegment = await fetchActiveSegment(supabase, conversationId);
  if (currentActiveSegment) {
    return continueSegment(supabase, currentActiveSegment, {
      ...options,
      action: "fallback",
    });
  }

  if (previousActiveSegment) {
    return continueSegment(supabase, previousActiveSegment, {
      ...options,
      action: "fallback",
    });
  }

  return null;
}

export async function persistSegmentDecision(options: {
  supabase: SupabaseClient;
  conversationId: string;
  userId: string;
  userMessageId: string;
  assistantMessageId: string;
  signal: SegmentSignalData | null;
  contextHint: ContextHint;
}): Promise<PersistSegmentDecisionResult> {
  const { supabase, conversationId, userId, userMessageId, assistantMessageId, signal, contextHint } = options;
  const activeSegment = contextHint.activeSegment;
  const effectiveSignal = signal?.signal ?? "continue";
  const nowIso = new Date().toISOString();
  let closedActiveSegment = false;

  try {
    if (effectiveSignal === "continue" || !signal) {
      if (activeSegment) {
        return continueSegment(supabase, activeSegment, {
          nowIso,
          userMessageId,
          assistantMessageId,
        });
      }

      const newSegment = await createSegment(supabase, {
        conversationId,
        userId,
        topicKey: "general",
        title: "General",
        nowIso,
      });
      if (newSegment) {
        return continueSegment(supabase, newSegment, {
          nowIso,
          userMessageId,
          assistantMessageId,
          action: "create",
        });
      }
    } else if (effectiveSignal === "new") {
      if (activeSegment) {
        if (activeSegment.message_count < 3) {
          return continueSegment(supabase, activeSegment, {
            nowIso,
            userMessageId,
            assistantMessageId,
          });
        }
        await updateSegment(supabase, activeSegment.id, {
          status: "closed",
          closed_at: nowIso,
        });
        closedActiveSegment = true;
      }

      const newSegment = await createSegment(supabase, {
        conversationId,
        userId,
        topicKey: signal.topicKey ?? "topic",
        title: signal.title ?? null,
        nowIso,
      });
      if (newSegment) {
        return continueSegment(supabase, newSegment, {
          nowIso,
          userMessageId,
          assistantMessageId,
          signal: "new",
          action: "create",
          closedSegmentId: activeSegment?.id ?? null,
        });
      }
    } else if (effectiveSignal === "revive") {
      const topicKey = signal.topicKey;
      let targetSegment: ConversationSegment | null = null;

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
        targetSegment = (target as ConversationSegment | null) ?? null;
      }

      if (targetSegment) {
        if (activeSegment) {
          await updateSegment(supabase, activeSegment.id, {
            status: "closed",
            closed_at: nowIso,
          });
          closedActiveSegment = true;
        }

        return continueSegment(supabase, targetSegment, {
          nowIso,
          userMessageId,
          assistantMessageId,
          signal: "revive",
          action: "revive",
          closedSegmentId: activeSegment?.id ?? null,
        });
      }

      if (activeSegment) {
        await updateSegment(supabase, activeSegment.id, {
          status: "closed",
          closed_at: nowIso,
        });
        closedActiveSegment = true;
      }

      const newSegment = await createSegment(supabase, {
        conversationId,
        userId,
        topicKey: signal.topicKey ?? "revived",
        title: signal.title ?? null,
        nowIso,
      });
      if (newSegment) {
        return continueSegment(supabase, newSegment, {
          nowIso,
          userMessageId,
          assistantMessageId,
          signal: "revive",
          action: "create",
          closedSegmentId: activeSegment?.id ?? null,
        });
      }
    }
  } catch (error) {
    const isUniqueViolation = error instanceof Error &&
      (error.message.includes("unique") || error.message.includes("duplicate"));
    if (isUniqueViolation || closedActiveSegment) {
      try {
        const fallbackResult = await rollbackToActiveSegment(supabase, conversationId, activeSegment, {
          nowIso,
          userMessageId,
          assistantMessageId,
        });
        if (fallbackResult) {
          if (isUniqueViolation) {
            console.warn("Segment unique constraint violation — continued on the active segment");
          }
          return fallbackResult;
        }
      } catch (rollbackError) {
        console.error("Segment rollback failed", rollbackError);
      }
    }

    console.error("Segment persistence failed", error);
  }

  return {
    signal: effectiveSignal,
    action: "fallback",
    segmentId: activeSegment?.id ?? null,
    closedSegmentId: null,
  };
}
