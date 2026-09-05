import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getConversationId } from "@/lib/db/conversations";

/**
 * GET /api/search?q=&project=
 * Content search across two scopes the history navigator surfaces:
 *  - conversation *message content* (mapped back to its segment/topic), so
 *    search reaches inside chats, not only topic titles and summaries.
 *  - saved *documents* (title + body), the assistant's saved outputs.
 * Returns short snippets around the match and an explicit scope per result.
 */
type SegmentMatch = { segmentId: string; snippet: string };
type DocMatch = { id: string; title: string; folder: string | null; snippet: string };

const SNIPPET_RADIUS = 60;

/** A single-line snippet centered on the first match of `q` in `text`. */
function snippetAround(text: string, q: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const idx = flat.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return flat.slice(0, SNIPPET_RADIUS * 2).trim();
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(flat.length, idx + q.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = (request.nextUrl.searchParams.get("q") || "").trim();
    const project = request.nextUrl.searchParams.get("project") || undefined;
    if (q.length < 2) {
      return NextResponse.json({ segments: [], documents: [] });
    }

    // Supabase .ilike patterns treat % and _ as wildcards; escape them.
    const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

    const conversationId = await getConversationId(supabase, user.id, project);

    const [messagesResult, documentsResult] = await Promise.all([
      conversationId
        ? supabase
            .from("messages")
            .select("segment_id, content, created_at")
            .eq("conversation_id", conversationId)
            .not("segment_id", "is", null)
            .ilike("content", pattern)
            .order("created_at", { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
      supabase
        .from("documents")
        .select("id, title, folder, content")
        .eq("user_id", user.id)
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

    // Collapse message matches to one snippet per segment (first/most recent).
    const segments: SegmentMatch[] = [];
    const seenSegments = new Set<string>();
    for (const row of (messagesResult.data ?? []) as { segment_id: string | null; content: string }[]) {
      if (!row.segment_id || seenSegments.has(row.segment_id)) continue;
      seenSegments.add(row.segment_id);
      segments.push({ segmentId: row.segment_id, snippet: snippetAround(row.content ?? "", q) });
    }

    const documents: DocMatch[] = ((documentsResult.data ?? []) as {
      id: string;
      title: string;
      folder: string | null;
      content: string;
    }[]).map((doc) => {
      const inTitle = doc.title?.toLowerCase().includes(q.toLowerCase());
      return {
        id: doc.id,
        title: doc.title,
        folder: doc.folder,
        snippet: inTitle ? "" : snippetAround(doc.content ?? "", q),
      };
    });

    return NextResponse.json(
      { segments, documents },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
