import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { deleteMessageById } from "@/lib/db/conversations";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;

  const authClient = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(authClient);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    await deleteMessageById(supabase, messageId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete message" },
      { status: 500 },
    );
  }
}
