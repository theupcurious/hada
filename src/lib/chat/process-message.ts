import type { SupabaseClient } from "@supabase/supabase-js";
import { agentLoop } from "@/lib/chat/agent-loop";
import { extractCardsFromToolResults } from "@/lib/chat/card-extraction";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { assembleConversationContext, maybeCompactConversation } from "@/lib/chat/context-manager";
import { generateFollowUpSuggestions } from "@/lib/chat/follow-up-suggestions";
import { extractMemoriesFromTurn } from "@/lib/chat/memory-extraction";
import { resolveProviderSelection, type OpenRouterReasoningConfig } from "@/lib/chat/providers";
import { resolveRunBudget } from "@/lib/chat/runtime-budgets";
import { DEFAULT_POLICY } from "@/lib/chat/tool-permissions";
import { createTools } from "@/lib/chat/tools";
import type { ToolContext } from "@/lib/chat/tools/types";
import { isAdminEmail } from "@/lib/auth/admin";
import { getOrCreateConversation, saveMessage, updateMessageById } from "@/lib/db/conversations";
import {
  getOpenRouterReasoningCapabilities,
  normalizeOpenRouterReasoningEffort,
} from "@/lib/openrouter/reasoning";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  AgentEvent,
  AgentRun,
  AgentRunToolCall,
  MessageMetadata,
  MessageSource,
  UserSettings,
} from "@/lib/types/database";

export interface ProcessMessageOptions {
  userId: string;
  message: string;
  source: MessageSource;
  supabase?: SupabaseClient;
  onEvent?: (event: AgentEvent) => Promise<void> | void;
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  backgroundJobId?: string;
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
  const runId = crypto.randomUUID();
  const agentRunStartedAt = Date.now();
  const toolCallLog: AgentRunToolCall[] = [];
  const toolCallArgs = new Map<string, Record<string, unknown>>();
  const toolResultsForCards: Array<{ name: string; result: string; args?: Record<string, unknown> }> =
    [];
  let agentRunStatus: AgentRun["status"] = "running";
  let responseText = "";
  let thrownError: unknown = null;
  let result: ProcessMessageResult | null = null;

  // Round 1: fetch conversation + integrations in parallel (both independent)
  const [conversation, integrationsResult] = await Promise.all([
    options.conversationId
      ? Promise.resolve({ id: options.conversationId })
      : getOrCreateConversation(supabase, options.userId),
    supabase.from("integrations").select("provider").eq("user_id", options.userId),
  ]);

  const connectedIntegrations = (
    (integrationsResult.data as Array<{ provider: string }> | null) ?? []
  ).map((row) => row.provider);

  const toolContext: ToolContext = {
    userId: options.userId,
    source: options.source,
    supabase,
  };
  const tools = createTools(toolContext, { connectedIntegrations });

  // Round 2: save user message + build prompt + create agent run in parallel.
  // NOTE: assembleConversationContext is intentionally excluded here and runs
  // after saveMessage commits. Running them in the same Promise.all creates a
  // race: PostgreSQL read-committed isolation means the SELECT can complete
  // before the INSERT is visible, causing the model to respond to the previous
  // message instead of the current one.
  const [agentRunId, userMessage, builtPrompt] = await Promise.all([
    createAgentRunRecord({
      supabase,
      conversationId: conversation.id,
      source: options.source,
      userId: options.userId,
      input: options.message,
      runId,
    }),
    options.userMessageId
      ? Promise.resolve({ id: options.userMessageId })
      : saveMessage(supabase, conversation.id, "user", options.message, {
          source: options.source,
          runId,
        }),
    buildSystemPrompt({
      supabase,
      userId: options.userId,
      source: options.source,
      tools,
      connectedIntegrations,
    }),
  ]);

  // Round 3: assemble context after user message is committed to DB.
  const context = await assembleConversationContext({ supabase, conversationId: conversation.id });

  toolContext.timezone =
    typeof builtPrompt.userSettings.timezone === "string"
      ? builtPrompt.userSettings.timezone
      : null;
  toolContext.onEvent = options.onEvent;
  toolContext.availableTools = tools;

  const allowModelOverrides = isAdminEmail(builtPrompt.userEmail);
  const provider = resolveProviderSelection(
    allowModelOverrides ? builtPrompt.userSettings : undefined,
  );
  const reasoning = resolveOpenRouterReasoningConfig(provider, builtPrompt.userSettings);
  const runtimeSection = buildRuntimeIdentitySection(provider);
  const systemPrompt = builtPrompt.prompt + "\n\n" + runtimeSection;

  let assembled = "";
  let fatalError: string | null = null;
  const runBudget = resolveRunBudget(options.message);

  try {
    for await (const event of agentLoop({
      messages: context.messages,
      systemPrompt,
      systemPromptParts: {
        stable: builtPrompt.stablePrompt,
        dynamic: builtPrompt.dynamicPrompt + "\n\n" + runtimeSection,
      },
      tools,
      provider,
      reasoning,
      timeout: runBudget.timeoutMs,
      idleTimeout: runBudget.idleTimeoutMs,
      permissionPolicy: DEFAULT_POLICY,
    })) {
      if (event.type === "tool_call") {
        toolCallArgs.set(event.callId, event.args);
      } else if (event.type === "text_delta") {
        assembled += event.content;
      } else if (event.type === "done") {
        // done.content is the terminal iteration text only — always use it
        // as the authoritative saved response, overriding any intermediate
        // "Let me search…" text that streaming may have accumulated.
        assembled = event.content;
      } else if (event.type === "tool_result") {
        toolCallLog.push({
          name: event.name,
          callId: event.callId,
          durationMs: event.durationMs,
          status: isToolResultError(event.result) ? "error" : "done",
        });
        toolResultsForCards.push({
          name: event.name,
          result: event.result,
          args: toolCallArgs.get(event.callId),
        });
      } else if (event.type === "error") {
        fatalError = event.message;
      }

      await emitEvent(options.onEvent, event);
    }
    responseText = assembled.trim() || fatalError || "I ran into an issue while processing that.";
    const cards = extractCardsFromToolResults(toolResultsForCards);
    const initialMetadata: MessageMetadata = {
      source: options.source,
      runId,
      ...(cards.length ? { cards } : {}),
      ...(options.backgroundJobId
        ? {
            backgroundJob: {
              id: options.backgroundJobId,
              status: fatalError ? deriveAgentRunStatus(fatalError) : "completed",
              pending: false,
            },
          }
        : {}),
      ...(fatalError ? { gatewayError: { code: "AGENT_ERROR", message: fatalError } } : {}),
    };

    const assistantMessage = options.assistantMessageId
      ? await updateMessageById(
          supabase,
          options.assistantMessageId,
          responseText,
          initialMetadata,
        )
      : await saveMessage(
          supabase,
          conversation.id,
          "assistant",
          responseText,
          initialMetadata,
        );

    await emitEvent(options.onEvent, { type: "message_saved", id: assistantMessage.id });

    const followUpSuggestions =
      fatalError || options.source !== "web"
        ? []
        : await generateFollowUpSuggestions({
            provider,
            userMessage: options.message,
            assistantResponse: responseText,
          }).catch(() => []);

    if (followUpSuggestions.length > 0) {
      initialMetadata.followUpSuggestions = followUpSuggestions;
      try {
        await updateMessageById(supabase, assistantMessage.id, responseText, initialMetadata);
      } catch (error) {
        // Follow-up suggestions are non-critical. If this persistence step fails,
        // keep the successful assistant response and continue the request.
        console.error("Failed to persist follow-up suggestions", error);
      }
      await emitEvent(options.onEvent, { type: "follow_up_suggestions", suggestions: followUpSuggestions });
    }

    void maybeCompactConversation({
      supabase,
      conversationId: conversation.id,
      provider,
      userId: options.userId,
    }).catch((e) => console.error("Compaction failed", e));

    void extractMemoriesFromTurn({
      supabase,
      userId: options.userId,
      provider,
      userMessage: options.message,
      assistantResponse: responseText,
    }).catch((error) => {
      console.error("Memory extraction failed", error);
    });

    agentRunStatus = fatalError ? deriveAgentRunStatus(fatalError) : "completed";
    result = {
      response: responseText,
      metadata: initialMetadata,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
    };
  } catch (error) {
    fatalError =
      fatalError ||
      (error instanceof Error ? error.message : "Unexpected error while processing the message.");
    responseText = responseText || assembled.trim() || fatalError;
    agentRunStatus = deriveAgentRunStatus(fatalError);
    thrownError = error;
  } finally {
    await finalizeAgentRunRecord({
      supabase,
      agentRunId,
      durationMs: Date.now() - agentRunStartedAt,
      status: agentRunStatus,
      error: fatalError,
      output: responseText,
      toolCalls: toolCallLog,
    });
  }

  if (thrownError) {
    throw thrownError;
  }

  if (!result) {
    throw new Error("processMessage completed without a result");
  }

  return result;
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

async function createAgentRunRecord(options: {
  supabase: SupabaseClient;
  conversationId: string;
  source: MessageSource;
  userId: string;
  input: string;
  runId: string;
}): Promise<string | null> {
  try {
    const { data, error } = await options.supabase
      .from("agent_runs")
      .insert({
        user_id: options.userId,
        conversation_id: options.conversationId,
        source: options.source,
        status: "running",
        input_preview: options.input.slice(0, 200),
        tool_calls: [],
        metadata: {
          runId: options.runId,
        },
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create agent run record", error);
      return null;
    }

    return typeof data?.id === "string" ? data.id : null;
  } catch (error) {
    console.error("Failed to create agent run record", error);
    return null;
  }
}

async function finalizeAgentRunRecord(options: {
  supabase: SupabaseClient;
  agentRunId: string | null;
  durationMs: number;
  status: AgentRun["status"];
  error: string | null;
  output: string;
  toolCalls: AgentRunToolCall[];
}): Promise<void> {
  if (!options.agentRunId) {
    return;
  }

  try {
    const { error } = await options.supabase
      .from("agent_runs")
      .update({
        status: options.status,
        finished_at: new Date().toISOString(),
        duration_ms: options.durationMs,
        output_preview: options.output.slice(0, 200),
        tool_calls: options.toolCalls,
        error: options.error,
      })
      .eq("id", options.agentRunId);

    if (error) {
      console.error("Failed to finalize agent run record", error);
    }
  } catch (error) {
    console.error("Failed to finalize agent run record", error);
  }
}

function deriveAgentRunStatus(error: string | null): AgentRun["status"] {
  if (!error) {
    return "completed";
  }

  return /\btimed out\b/i.test(error) ? "timeout" : "failed";
}

function isToolResultError(result: string): boolean {
  const trimmed = result.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed === "Tool not found." || trimmed.startsWith("Tool error:")) {
    return true;
  }

  try {
    const parsed = JSON.parse(trimmed) as { success?: unknown; error?: unknown };
    return parsed.success === false || typeof parsed.error === "string";
  } catch {
    return false;
  }
}

function buildRuntimeIdentitySection(
  provider: ReturnType<typeof resolveProviderSelection>,
): string {
  return [
    "## Runtime Identity",
    "- Assistant: Hada",
    "- Runtime: Hada built-in agent loop",
    `- Current LLM provider: ${provider.provider}`,
    `- Current LLM model: ${provider.model}`,
    "- When asked about your model/provider/runtime, answer using these values.",
    "- Do not mention internal or legacy platform names unless they are explicitly provided in this section.",
  ].join("\n");
}

function resolveOpenRouterReasoningConfig(
  provider: ReturnType<typeof resolveProviderSelection>,
  settings: UserSettings,
): OpenRouterReasoningConfig | undefined {
  if (provider.provider !== "openrouter" || settings.llm_reasoning_enabled !== true) {
    return undefined;
  }

  const capabilities = getOpenRouterReasoningCapabilities(provider.model);
  if (!capabilities.supportsReasoningToggle) {
    return undefined;
  }

  const effort = capabilities.supportsEffort
    ? normalizeOpenRouterReasoningEffort(
        typeof settings.llm_reasoning_effort === "string" ? settings.llm_reasoning_effort : undefined,
      ) || undefined
    : undefined;

  return {
    enabled: true,
    ...(effort ? { effort } : {}),
  };
}
