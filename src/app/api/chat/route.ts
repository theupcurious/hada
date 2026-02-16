import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/chat/process-message";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const result = await processMessage({
      userId: user.id,
      message,
      source: "web",
      supabase,
    });

    return NextResponse.json({
      id: result.assistantMessageId,
      content: result.response,
      role: "assistant",
      conversationId: result.conversationId,
      userMessageId: result.userMessageId,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
