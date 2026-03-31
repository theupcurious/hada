import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { clearLatestConversation } from "@/lib/db/conversations";

export async function DELETE() {
  try {
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const cleared = await clearLatestConversation(supabase, user.id);

    return NextResponse.json({
      success: true,
      cleared,
    });
  } catch (error) {
    console.error("Conversation reset API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to clear chat",
      },
      { status: 500 },
    );
  }
}
