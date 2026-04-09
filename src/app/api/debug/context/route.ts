import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("email")
    .eq("id", user.id)
    .single();

  if (!isAdminEmail((userData as { email?: string } | null)?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, created_at, compacted_through, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const conversationId = (conversation as { id?: string } | null)?.id ?? null;

  const [memoriesResult, messageCountResult, summaryCountResult, segmentsResult, latestAssistantResult] = await Promise.all([
    supabase
      .from("user_memories")
      .select("topic, content, kind, pinned, updated_at")
      .eq("user_id", user.id)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50),
    conversationId
      ? supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
      : Promise.resolve({ count: 0 }),
    conversationId
      ? supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .contains("metadata", { type: "compaction" })
      : Promise.resolve({ count: 0 }),
    conversationId
      ? supabase
          .from("conversation_segments")
          .select("id, status, title, topic_key, summary, last_active_at, message_count, metadata")
          .eq("conversation_id", conversationId)
          .order("last_active_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    conversationId
      ? supabase
          .from("messages")
          .select("id, metadata, created_at")
          .eq("conversation_id", conversationId)
          .eq("role", "assistant")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    conversation,
    memories: memoriesResult.data || [],
    stats: {
      totalMessages: messageCountResult.count || 0,
      compactionSummaries: summaryCountResult.count || 0,
    },
    segments: segmentsResult.data || [],
    latestRetrieval: (latestAssistantResult.data as { metadata?: { retrieval?: unknown } | null } | null)?.metadata?.retrieval ?? null,
  });
}
