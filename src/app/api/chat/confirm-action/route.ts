import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { saveMessage } from "@/lib/db/conversations";
import { createTools } from "@/lib/chat/tools";
import type { ToolContext } from "@/lib/chat/tools/types";
import type { Message, MessageMetadata } from "@/lib/types/database";

export const maxDuration = 120;

const ACTION_TIMEOUT_MS = 60_000;

interface ConfirmActionBody {
  messageId?: unknown;
  decision?: unknown;
  editedArgs?: unknown;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const body = (await request.json().catch(() => ({}))) as ConfirmActionBody;
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null;
  const editedArgs =
    body.editedArgs && typeof body.editedArgs === "object" && !Array.isArray(body.editedArgs)
      ? (body.editedArgs as Record<string, unknown>)
      : null;

  if (!messageId || !decision) {
    return jsonError("messageId and a valid decision are required", 400);
  }

  // Resolve the user's conversation so we only touch messages they own.
  const { data: conversation } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return jsonError("Conversation not found", 404);
  }

  const { data: messageRow } = await admin
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .eq("conversation_id", conversation.id)
    .maybeSingle();

  const message = messageRow as Message | null;
  const confirmation = message?.metadata?.confirmation;

  if (!message || !confirmation?.pending || !confirmation.function?.name) {
    return jsonError("No pending action found for this message", 404);
  }

  const toolName = confirmation.function.name;
  const baseArgs = confirmation.function.arguments ?? {};
  const args = editedArgs ? { ...baseArgs, ...editedArgs } : baseArgs;

  const resolvedMetadata: MessageMetadata = {
    ...(message.metadata ?? {}),
    confirmation: {
      ...confirmation,
      pending: false,
      resolved_at: new Date().toISOString(),
      cancelled: decision === "reject",
      function: { name: toolName, arguments: args },
    },
  };

  // Mark the proposal resolved regardless of outcome so the card stops showing.
  await admin
    .from("messages")
    .update({ metadata: resolvedMetadata })
    .eq("id", message.id)
    .eq("conversation_id", conversation.id);

  if (decision === "reject") {
    const cancelled = await saveMessage(
      admin,
      conversation.id,
      "assistant",
      "Okay — I won't run that action. Let me know if you'd like to do something else.",
      { source: "web" },
    );
    return Response.json({
      status: "cancelled",
      message: serializeMessage(cancelled),
    });
  }

  // Approved — execute the tool server-side with the same context the agent uses.
  const { data: userRow } = await admin
    .from("users")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();
  const timezone =
    userRow && typeof (userRow as { settings?: { timezone?: unknown } }).settings?.timezone === "string"
      ? ((userRow as { settings?: { timezone?: string } }).settings!.timezone as string)
      : null;

  const { data: integrationsData } = await admin
    .from("integrations")
    .select("provider")
    .eq("user_id", user.id);
  const connectedIntegrations = (
    (integrationsData as Array<{ provider: string }> | null) ?? []
  ).map((row) => row.provider);

  const toolContext: ToolContext = {
    userId: user.id,
    source: "web",
    supabase: admin,
    timezone,
  };
  const tools = createTools(toolContext, { connectedIntegrations });
  toolContext.availableTools = tools;

  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    const failure = await saveMessage(
      admin,
      conversation.id,
      "assistant",
      `I couldn't run that action — the "${toolName}" tool is no longer available.`,
      { source: "web", gatewayError: { code: "TOOL_UNAVAILABLE", message: toolName } },
    );
    return Response.json({ status: "error", message: serializeMessage(failure) });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);
  let rawResult: string;
  try {
    rawResult = await tool.execute(args, { signal: controller.signal });
  } catch (error) {
    rawResult = `Tool error: ${error instanceof Error ? error.message : "execution failed"}`;
  } finally {
    clearTimeout(timeout);
  }

  const failed = isToolFailure(rawResult);
  const outcomeText = failed
    ? `⚠️ I couldn't complete that action. ${summarizeToolResult(rawResult)}`
    : `✅ Done. ${summarizeToolResult(rawResult)}`.trim();

  const outcome = await saveMessage(admin, conversation.id, "assistant", outcomeText, {
    source: "web",
    ...(failed ? { gatewayError: { code: "ACTION_FAILED", message: rawResult.slice(0, 200) } } : {}),
  });

  return Response.json({
    status: failed ? "error" : "completed",
    message: serializeMessage(outcome),
  });
}

function serializeMessage(message: Message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    created_at: message.created_at,
  };
}

function isToolFailure(result: string): boolean {
  const trimmed = result.trim();
  if (!trimmed) return false;
  if (trimmed === "Tool not found." || trimmed.startsWith("Tool error:")) return true;
  try {
    const parsed = JSON.parse(trimmed) as { success?: unknown; error?: unknown };
    return parsed.success === false || typeof parsed.error === "string";
  } catch {
    return false;
  }
}

// Produce a short human-readable confirmation from a tool result that may be
// raw JSON or plain text.
function summarizeToolResult(result: string): string {
  const trimmed = result.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidate =
      pickString(parsed.message) ??
      pickString(parsed.summary) ??
      pickString(parsed.error) ??
      pickString((parsed as { result?: unknown }).result);
    if (candidate) return truncate(candidate);
  } catch {
    // Not JSON — fall through to the raw string.
  }
  return truncate(trimmed);
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncate(text: string, max = 280): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
