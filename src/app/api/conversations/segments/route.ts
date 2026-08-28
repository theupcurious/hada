import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getConversationId } from "@/lib/db/conversations";
import { listConversationSegments } from "@/lib/db/segments";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/conversations/segments
 * List the user's conversation segments (topics) for the history navigator,
 * most recently active first. Scoped to a space via ?project=<id> (absent =
 * the default "General" space).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = request.nextUrl.searchParams.get("project") || undefined;
    const conversationId = await getConversationId(supabase, user.id, project);

    if (!conversationId) {
      return NextResponse.json({ segments: [] });
    }

    const segments = await listConversationSegments(supabase, conversationId);

    return NextResponse.json({ segments });
  } catch (error) {
    console.error("Segments API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
