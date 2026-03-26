import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearLatestConversation } from "@/lib/db/conversations";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
