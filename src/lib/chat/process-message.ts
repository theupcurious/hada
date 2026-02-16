import type { SupabaseClient } from "@supabase/supabase-js";
import { agentLoop } from "@/lib/chat/agent-loop";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { assembleConversationContext, maybeCompactConversation } from "@/lib/chat/context-manager";
import { resolveProviderSelection } from "@/lib/chat/providers";
import { createTools } from "@/lib/chat/tools";
import type { ToolContext } from "@/lib/chat/tools/types";
import { getOrCreateConversation, saveMessage } from "@/lib/db/conversations";
import { createAdminClient } from "@/lib/supabase/server";
import type { AgentEvent, MessageMetadata, MessageSource } from "@/lib/types/database";

export interface ProcessMessageOptions {
  userId: string;
  message: string;
  source: MessageSource;
  supabase?: SupabaseClient;
  onEvent?: (event: AgentEvent) => Promise<void> | void;
}

export interface ProcessMessageResult {
  response: string;
  metadata: MessageMetadata;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}

export async function processMessage(options: ProcessMessageOptions): Promise<ProcessMessageResult> {
  const supabase = options.supabase || createAdminClient();
  const conversation = await getOrCreateConversation(supabase, options.userId);
  const runId = crypto.randomUUID();

  const userMessage = await saveMessage(
    supabase,
    conversation.id,
    "user",
    options.message,
    {
      source: options.source,
      runId,
    },
  );

  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider")
    .eq("user_id", options.userId);

  const toolContext: ToolContext = {
    userId: options.userId,
    source: options.source,
    supabase,
  };
  const tools = createTools(toolContext, {
    connectedIntegrations: (integrations || []).map((row) => row.provider),
  });

  const builtPrompt = await buildSystemPrompt({
    supabase,
    userId: options.userId,
    source: options.source,
    tools,
  });

  const provider = resolveProviderSelection(builtPrompt.userSettings);
  const context = await assembleConversationContext({
    supabase,
    conversationId: conversation.id,
  });

  let assembled = "";
  let fatalError: string | null = null;

  for await (const event of agentLoop({
    messages: context.messages,
    systemPrompt: builtPrompt.prompt,
    tools,
    provider,
  })) {
    if (event.type === "text_delta") {
      assembled += event.content;
    } else if (event.type === "done") {
      if (!assembled.trim()) {
        assembled = event.content;
      }
    } else if (event.type === "error") {
      fatalError = event.message;
    }

    await emitEvent(options.onEvent, event);
  }

  const responseText = assembled.trim() || fatalError || "I ran into an issue while processing that.";
  const assistantMetadata: MessageMetadata = {
    source: options.source,
    runId,
    ...(fatalError ? { gatewayError: { code: "AGENT_ERROR", message: fatalError } } : {}),
  };

  const assistantMessage = await saveMessage(
    supabase,
    conversation.id,
    "assistant",
    responseText,
    assistantMetadata,
  );

  await maybeCompactConversation({
    supabase,
    conversationId: conversation.id,
    provider,
  });

  return {
    response: responseText,
    metadata: assistantMetadata,
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
  };
}

async function emitEvent(
  callback: ProcessMessageOptions["onEvent"],
  event: AgentEvent,
): Promise<void> {
  if (!callback) {
    return;
  }

  try {
    await callback(event);
  } catch (error) {
    console.error("Failed to emit processMessage event", error);
  }
}
