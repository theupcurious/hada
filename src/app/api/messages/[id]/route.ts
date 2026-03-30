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
    .select("id, conversation_id, role, created_at, metadata")
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

  const metadata =
    message.metadata && typeof message.metadata === "object"
      ? (message.metadata as Record<string, unknown>)
      : null;
  const runId = typeof metadata?.runId === "string" ? metadata.runId.trim() : "";

  const messageIdsToDelete = new Set<string>([messageId]);
  const roleByMessageId = new Map<string, string>([[messageId, message.role]]);

  if (runId) {
    const { data: runMessages, error: runMessagesError } = await supabase
      .from("messages")
      .select("id, role")
      .eq("conversation_id", message.conversation_id)
      .eq("metadata->>runId", runId);

    if (runMessagesError) {
      return NextResponse.json({ error: "Failed to resolve chat turn" }, { status: 500 });
    }

    for (const row of runMessages || []) {
      if (typeof row.id === "string" && row.id.length > 0) {
        messageIdsToDelete.add(row.id);
      }
      if (typeof row.id === "string" && typeof row.role === "string") {
        roleByMessageId.set(row.id, row.role);
      }
    }
  }

  const hasRoleInDeleteSet = (role: "user" | "assistant") => {
    for (const id of messageIdsToDelete) {
      if (roleByMessageId.get(id) === role) {
        return true;
      }
    }
    return false;
  };

  if (message.role === "assistant" && !hasRoleInDeleteSet("user")) {
    const { data: previousUser } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", message.conversation_id)
      .eq("role", "user")
      .lte("created_at", message.created_at)
      .neq("id", messageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousUser?.id) {
      messageIdsToDelete.add(previousUser.id);
      roleByMessageId.set(previousUser.id, "user");
    }
  } else if (message.role === "user" && !hasRoleInDeleteSet("assistant")) {
    const { data: nextAssistant } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", message.conversation_id)
      .eq("role", "assistant")
      .gte("created_at", message.created_at)
      .neq("id", messageId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextAssistant?.id) {
      messageIdsToDelete.add(nextAssistant.id);
      roleByMessageId.set(nextAssistant.id, "assistant");
    }
  }

  const resolvedMessageIds = [...messageIdsToDelete];

  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", message.conversation_id)
    .in("id", resolvedMessageIds);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ success: true, deletedIds: resolvedMessageIds });
}
