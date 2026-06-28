import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lightweight projection of a conversation segment for the history/navigation
 * surface. The agent already maintains segments (title, summary, topic_key) via
 * the segment-router — this read-side helper exposes them so the user can
 * navigate the one continuous thread by topic instead of scrolling.
 */
export interface SegmentListItem {
  id: string;
  title: string | null;
  topic_key: string | null;
  summary: string | null;
  status: "active" | "closed" | "archived";
  message_count: number;
  opened_at: string;
  last_active_at: string;
}

/**
 * List a conversation's segments, most recently active first. Excludes empty
 * segments (no messages yet) so the history list only shows real topics.
 */
export async function listConversationSegments(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = 100,
): Promise<SegmentListItem[]> {
  const { data, error } = await supabase
    .from("conversation_segments")
    .select(
      "id, title, topic_key, summary, status, message_count, opened_at, last_active_at",
    )
    .eq("conversation_id", conversationId)
    .order("last_active_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list segments: ${error.message}`);
  }

  return ((data || []) as SegmentListItem[]).filter(
    (segment) => (segment.message_count ?? 0) > 0,
  );
}
