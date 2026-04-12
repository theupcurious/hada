import type { SupabaseClient } from "@supabase/supabase-js";
import { agentLoop, extractSegmentSignal } from "@/lib/chat/agent-loop";
import { extractCardsFromToolResults } from "@/lib/chat/card-extraction";
import { mergeRecentConversationWindow, retrieveRankedConversationContext } from "@/lib/chat/context-retrieval";
import type { LLMMessage } from "@/lib/chat/providers";
import { computeContextHint, persistSegmentDecision, type ContextHint } from "@/lib/chat/segment-router";
import { persistSegmentArtifact } from "@/lib/chat/segment-artifacts";
import { queueSegmentSummaryRefresh } from "@/lib/chat/segment-summaries";
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
    (async () => {
      const { data: activeSegmentRow } = await supabase
        .from("conversation_segments")
        .select("title, topic_key, message_count, last_active_at")
        .eq("conversation_id", conversation.id)
        .eq("status", "active")
        .maybeSingle();
      return buildSystemPrompt({
        supabase,
        userId: options.userId,
        source: options.source,
        tools,
        connectedIntegrations,
        userMessage: options.message,
        activeSegment: activeSegmentRow ?? null,
      });
    })(),
  ]);

  // Round 3: assemble context after user message is committed to DB.
  const [legacyContext, contextHint] = await Promise.all([
    assembleConversationContext({ supabase, conversationId: conversation.id }),
    computeContextHint({
      supabase,
      conversationId: conversation.id,
      userMessage: options.message,
    }).catch((e: unknown) => {
      console.error("Context hint failed", e);
      return null as ContextHint | null;
    }),
  ]);
  const context = await resolveConversationContext({
    supabase,
    conversationId: conversation.id,
    userId: options.userId,
    userMessage: options.message,
    legacyContext,
    contextHint,
  });

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
  let rawContentFromDone = "";
  let fatalError: string | null = null;
  let extractedSegmentSignal: ReturnType<typeof extractSegmentSignal>["signal"] = null;
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
        rawContentFromDone = event.rawContent ?? event.content;
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
    const rawText = assembled.trim() || fatalError || "I ran into an issue while processing that.";
    // Extract segment signal from the unfiltered LLM output (rawContentFromDone) so the
    // <!-- segment:... --> comment survives the stream filter that strips it from visible text.
    const signalSource = rawContentFromDone.trim() || rawText;
    const { signal: segmentSignalResult } = extractSegmentSignal(signalSource);
    const strippedText = rawText;

    // Server-side heuristic fallback: if the LLM didn't emit a segment signal
    // (or emitted "continue"), detect obvious topic shifts automatically.
    extractedSegmentSignal = maybeOverrideSegmentSignal({
      llmSignal: segmentSignalResult,
      userMessage: options.message,
      contextHint,
    });
    if (extractedSegmentSignal !== segmentSignalResult) {
      console.log("[segment] Server-side override: LLM said",
        segmentSignalResult?.signal ?? "(none)",
        "→ overridden to", extractedSegmentSignal?.signal ?? "(none)",
      );
    } else {
      console.log("[segment] LLM signal:",
        segmentSignalResult
          ? `${segmentSignalResult.signal}${segmentSignalResult.topicKey ? `:${segmentSignalResult.topicKey}` : ""}`
          : "(none — defaulting to continue)",
      );
    }
    responseText = strippedText;
    const cards = extractCardsFromToolResults(toolResultsForCards);
    const retrievalMetadata = buildRetrievalMetadata(context, contextHint);
    const initialMetadata: MessageMetadata = {
      source: options.source,
      runId,
      retrieval: retrievalMetadata,
      ...(cards.length ? { cards } : {}),
      ...(extractedSegmentSignal ? { segmentSignal: extractedSegmentSignal } : {}),
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

    // Start follow-up suggestions in parallel with saving the message — it only
    // needs responseText, not the saved message ID, so there is no data dependency.
    const followUpPromise =
      fatalError || options.source !== "web"
        ? Promise.resolve([] as string[])
        : generateFollowUpSuggestions({
            provider,
            userMessage: options.message,
            assistantResponse: responseText,
          }).catch(() => [] as string[]);

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

    const followUpSuggestions = await followUpPromise;

    if (followUpSuggestions.length > 0) {
      initialMetadata.followUpSuggestions = followUpSuggestions;
      // Persist suggestions in the background — non-critical, don't block the response.
      updateMessageById(supabase, assistantMessage.id, responseText, initialMetadata).catch(
        (error) => console.error("Failed to persist follow-up suggestions", error),
      );
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

    if (contextHint !== null) {
      try {
        const segmentDecision = await persistSegmentDecision({
          supabase,
          conversationId: conversation.id,
          userId: options.userId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          signal: extractedSegmentSignal ?? null,
          contextHint,
        });

        void (async () => {
          const postResponseTasks: Array<Promise<unknown>> = [];

          if (segmentDecision.closedSegmentId) {
            postResponseTasks.push(
              queueSegmentSummaryRefresh({
                supabase,
                provider,
                segmentId: segmentDecision.closedSegmentId,
                reason: "closed",
              }),
            );
          }

          if (segmentDecision.signal === "revive" && segmentDecision.segmentId) {
            postResponseTasks.push(
              queueSegmentSummaryRefresh({
                supabase,
                provider,
                segmentId: segmentDecision.segmentId,
                reason: "revived",
              }),
            );
          } else if (segmentDecision.action === "continue" && segmentDecision.segmentId) {
            postResponseTasks.push(
              queueSegmentSummaryRefresh({
                supabase,
                provider,
                segmentId: segmentDecision.segmentId,
                reason: "grown",
              }),
            );
          }

          if (segmentDecision.segmentId) {
            postResponseTasks.push(
              persistSegmentArtifact(supabase, {
                userId: options.userId,
                conversationId: conversation.id,
                segmentId: segmentDecision.segmentId,
                sourceMessageId: userMessage.id,
                assistantMessageId: assistantMessage.id,
                triggeringMessage: options.message,
                assistantResponse: responseText,
                metadata: {
                  topic_key: extractedSegmentSignal?.topicKey ?? null,
                },
              }),
            );
          }

          await Promise.allSettled(postResponseTasks);
        })().catch((error) => {
          console.error("Segment post-response tasks failed", error);
        });
      } catch (e: unknown) {
        console.error("Segment persistence failed", e);
      }
    }

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

async function resolveConversationContext(options: {
  supabase: SupabaseClient;
  conversationId: string;
  userId: string;
  userMessage: string;
  legacyContext: Awaited<ReturnType<typeof assembleConversationContext>>;
  contextHint: ContextHint | null;
}) {
  if (!isRankedContextEnabled() || options.contextHint === null) {
    return options.legacyContext;
  }

  try {
    const rankedContext = await retrieveRankedConversationContext({
      supabase: options.supabase,
      conversationId: options.conversationId,
      userId: options.userId,
      userMessage: options.userMessage,
      contextHint: options.contextHint,
    });

    const mergedMessages = mergeRecentConversationWindow({
      rankedMessages: rankedContext.messages,
      legacyMessages: options.legacyContext.messages,
    });
    const messages = ensureCurrentUserTurnIncluded(mergedMessages, options.userMessage);
    const estimatedTokens = estimateMessageTokens(messages);

    return {
      ...rankedContext,
      messages,
      estimatedTokens,
    };
  } catch (error) {
    console.error("Ranked context retrieval failed", error);
    return options.legacyContext;
  }
}

function ensureCurrentUserTurnIncluded(messages: LLMMessage[], userMessage: string): LLMMessage[] {
  const latest = messages.at(-1);
  if (latest?.role === "user" && latest.content === userMessage) {
    return messages;
  }

  return [
    ...messages,
    {
      role: "user" as const,
      content: userMessage,
    },
  ];
}

function estimateMessageTokens(messages: LLMMessage[]): number {
  return messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0);
}

function buildRetrievalMetadata(
  context: Awaited<ReturnType<typeof resolveConversationContext>>,
  contextHint: ContextHint | null,
): MessageMetadata["retrieval"] {
  const strategy =
    "strategy" in context && (context.strategy === "ranked" || context.strategy === "recency")
      ? context.strategy
      : "recency";
  const sourceBreakdown =
    "sourceBreakdown" in context && typeof context.sourceBreakdown === "object" && context.sourceBreakdown
      ? (context.sourceBreakdown as NonNullable<MessageMetadata["retrieval"]>["sourceBreakdown"])
      : undefined;
  const selections =
    "selections" in context && Array.isArray(context.selections)
      ? (context.selections as NonNullable<MessageMetadata["retrieval"]>["selections"])
      : undefined;
  return {
    strategy,
    estimatedTokens: context.estimatedTokens,
    ...(contextHint
      ? {
          hint: {
            confidence: contextHint.confidence,
            reason: contextHint.reason,
            activeSegmentId: contextHint.activeSegment?.id ?? null,
            candidateSegmentIds: contextHint.candidateSegments.map((segment) => segment.id),
          },
        }
      : {}),
    ...(sourceBreakdown ? { sourceBreakdown } : {}),
    ...(selections ? { selections } : {}),
  };
}

function isRankedContextEnabled(): boolean {
  const raw = process.env.HADA_ENABLE_RANKED_CONTEXT_RETRIEVAL;
  if (!raw) {
    return true;
  }

  return !["0", "false", "off"].includes(raw.trim().toLowerCase());
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

// ─── Server-side segment heuristic fallback ───────────────────────────────────
// If the LLM doesn't emit a segment signal or always says "continue", we
// detect obvious topic shifts ourselves based on keyword overlap and segment
// depth.  This ensures segmentation works even with models that ignore the
// prompt instruction.

const SEGMENT_STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","was","are","were","be","been","being","have","has","had","do","does","did",
  "will","would","could","should","may","might","shall","can","need","dare",
  "i","you","he","she","it","we","they","me","him","her","us","them",
  "my","your","his","its","our","their","this","that","these","those",
  "what","which","who","how","when","where","why","not","no","so","if","then",
]);

function heuristicTokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !SEGMENT_STOP_WORDS.has(w)),
  );
}

function heuristicJaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function deriveTopicKey(text: string): string {
  const tokens = heuristicTokenize(text);
  const words = [...tokens].slice(0, 3);
  if (!words.length) return "new-topic";
  return words.join("-");
}

function deriveTitleFromMessage(text: string): string {
  const cleaned = text
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").slice(0, 5);
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || "New Topic";
}

type SegmentSignalLike = { signal: "continue" | "new" | "revive"; topicKey?: string; title?: string } | null;

function maybeOverrideSegmentSignal(options: {
  llmSignal: SegmentSignalLike;
  userMessage: string;
  contextHint: ContextHint | null;
}): SegmentSignalLike {
  const { llmSignal, userMessage, contextHint } = options;

  // If the LLM already said "new" or "revive", respect it.
  if (llmSignal && llmSignal.signal !== "continue") {
    return llmSignal;
  }

  // No context hint or no active segment — can't evaluate.
  if (!contextHint?.activeSegment) {
    return llmSignal;
  }

  const activeSegment = contextHint.activeSegment;
  const messageCount = activeSegment.message_count ?? 0;

  // Guard 1: Don't override for young segments — need at least 4 full
  // user-assistant exchanges (8 messages) before considering a split.
  if (messageCount < 8) {
    return llmSignal;
  }

  // Guard 2: Require the segment to have a real summary. Without one
  // the segment metadata is just "General / general" and every message
  // would register as zero overlap.
  const summaryText = (activeSegment.summary ?? "").trim();
  if (!summaryText || summaryText.length < 20) {
    return llmSignal;
  }

  // Guard 3: Short or pronoun-heavy messages ("what about that?",
  // "any others?", "thanks") are almost always follow-ups, regardless
  // of keyword overlap. Require ≥4 content tokens.
  const messageTokens = heuristicTokenize(userMessage);
  if (messageTokens.size < 4) {
    return llmSignal;
  }

  // Compute keyword overlap between the user's message and the segment metadata.
  const segmentText = [
    activeSegment.title ?? "",
    summaryText,
    activeSegment.topic_key ?? "",
  ].join(" ");
  const segmentTokens = heuristicTokenize(segmentText);
  const overlap = heuristicJaccard(messageTokens, segmentTokens);

  // Thresholds: more lenient for very large segments where a split is overdue.
  const overlapThreshold = messageCount >= 30 ? 0.10 : 0.05;

  if (overlap < overlapThreshold) {
    const topicKey = deriveTopicKey(userMessage);
    const title = deriveTitleFromMessage(userMessage);
    console.log(
      `[segment] Heuristic override: segment "${activeSegment.title}" has ${messageCount} msgs, ` +
      `jaccard=${overlap.toFixed(3)} < ${overlapThreshold} → creating new segment "${title}" (${topicKey})`,
    );
    return {
      signal: "new",
      topicKey,
      title,
    };
  }

  return llmSignal;
}
