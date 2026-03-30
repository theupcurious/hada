import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const messageId = params.id;

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, conversation_id")
    .eq("id", messageId)
    .single();

  if (messageError || !message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", message.conversation_id)
    .eq("user_id", user.id)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("conversation_id", message.conversation_id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: messageId });
}
