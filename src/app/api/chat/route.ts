import { NextRequest } from "next/server";
import { processMessage } from "@/lib/chat/process-message";
import { createClient } from "@/lib/supabase/server";
import type { AgentEvent } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const emit = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected — writes will fail silently.
        }
      };

      processMessage({
        userId: user.id,
        message,
        source: "web",
        supabase,
        onEvent: (event: AgentEvent) => {
          emit(event);
        },
      })
        .then((result) => {
          emit({
            type: "complete",
            id: result.assistantMessageId,
            conversationId: result.conversationId,
            userMessageId: result.userMessageId,
            isError: !!result.metadata.gatewayError,
            errorMessage: result.metadata.gatewayError?.message,
          });
        })
        .catch((error: unknown) => {
          emit({
            type: "error",
            message:
              error instanceof Error ? error.message : "Internal server error",
          });
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
