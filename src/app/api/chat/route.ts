import { NextRequest } from "next/server";
import { enqueueBackgroundJob, scheduleBackgroundJobProcessing } from "@/lib/background-jobs";
import { isLongJobMessage } from "@/lib/chat/runtime-budgets";
import { processMessage } from "@/lib/chat/process-message";
import { createClient } from "@/lib/supabase/server";
import type { AgentEvent } from "@/lib/types/database";

export const maxDuration = 300;

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

      const runDirectly = () => {
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
              cards: Array.isArray(result.metadata.cards) ? result.metadata.cards : undefined,
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
      };

      if (isLongJobMessage(message)) {
        void (async () => {
          let fellBackToDirectRun = false;

          try {
            const queued = await enqueueBackgroundJob({
              supabase,
              userId: user.id,
              source: "web",
              message,
            });

            scheduleBackgroundJobProcessing({
              requestOrigin: request.nextUrl.origin,
              jobId: queued.jobId,
              processingToken: queued.processingToken,
            });

            emit({
              type: "background_job",
              jobId: queued.jobId,
              status: "queued",
              conversationId: queued.conversationId,
              userMessageId: queued.userMessageId,
              assistantMessageId: queued.assistantMessageId,
            });
          } catch (error) {
            if (shouldFallbackToDirectRun(error)) {
              fellBackToDirectRun = true;
              console.warn("Background job tables unavailable; falling back to direct chat run.", error);
              runDirectly();
              return;
            }

            emit({
              type: "error",
              message:
                error instanceof Error ? error.message : "Failed to queue background job.",
            });
          } finally {
            if (fellBackToDirectRun) {
              return;
            }

            try {
              controller.close();
            } catch {
              // Already closed.
            }
          }
        })();
        return;
      }

      runDirectly();
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

function shouldFallbackToDirectRun(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("background_jobs") &&
    (
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find")
    )
  );
}
