import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getConversationId } from "@/lib/db/conversations";
import { listConversationSegments } from "@/lib/db/segments";
import { NextResponse } from "next/server";

/**
 * GET /api/conversations/segments
 * List the user's conversation segments (topics) for the history navigator,
 * most recently active first.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversationId = await getConversationId(supabase, user.id);

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
