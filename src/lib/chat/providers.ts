import { getOpenRouterReasoningCapabilities } from "@/lib/openrouter/reasoning";
import type { LLMProviderName, OpenRouterReasoningEffort, UserSettings } from "@/lib/types/database";

export const DEFAULT_PROVIDER: LLMProviderName = "openrouter";

export interface ProviderConfig {
  baseUrl: string;
  defaultModel: string;
  fallbackModel?: string;
  native?: boolean;
  extraHeaders?: Record<string, string>;
  contextWindow?: number;  // tokens
  apiKeyHeader?: string;  // if set, use this header name instead of "Authorization: Bearer"
}

export interface OpenRouterReasoningConfig {
  enabled: boolean;
  effort?: OpenRouterReasoningEffort;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  extraContent?: {
    google?: {
      thought_signature?: string;
    };
  };
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  reasoning?: string;
  reasoning_details?: unknown[];
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
    extra_content?: {
      google?: {
        thought_signature?: string;
      };
    };
  }>;
}

export interface LLMResult {
  content: string;
  toolCalls: LLMToolCall[];
  reasoning?: string;
  reasoning_details?: unknown[];
}

export type LLMStreamEvent =
  | { type: "text"; chunk: string }
  | { type: "done"; content: string; toolCalls: LLMToolCall[]; reasoning?: string; reasoning_details?: unknown[] };

export const PROVIDERS: Record<LLMProviderName, ProviderConfig> = {
  minimax: {
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M2.7",
    contextWindow: 40_000,
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5-20250929",
    native: true,
    contextWindow: 200_000,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    contextWindow: 128_000,
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    contextWindow: 1_000_000,
  },
  kimi: {
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-auto",
    contextWindow: 128_000,
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    contextWindow: 64_000,
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b",
    contextWindow: 32_000,
  },
  mimo: {
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
    defaultModel: "mimo-v2-pro",
    contextWindow: 256_000,
    apiKeyHeader: "api-key",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "minimax/minimax-m2.7",
    fallbackModel: "moonshotai/kimi-k2.5",
    contextWindow: 128_000,
    extraHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://hada.app",
      "X-Title": "Hada",
    },
  },
};

export interface ProviderSelection {
  provider: LLMProviderName;
  model: string;
  fallbackModel?: string;
  apiKey: string;
  config: ProviderConfig;
}

export function resolveProviderSelection(settings?: UserSettings): ProviderSelection {
  const preferred = String(
    settings?.llm_provider || process.env.LLM_PROVIDER || DEFAULT_PROVIDER,
  ).toLowerCase() as LLMProviderName;
  const provider = PROVIDERS[preferred] ? preferred : DEFAULT_PROVIDER;
  const config = { ...PROVIDERS[provider] };

  // LLM_BASE_URL overrides the provider's default base URL
  if (process.env.LLM_BASE_URL) {
    config.baseUrl = process.env.LLM_BASE_URL;
  }

  const model =
    (typeof settings?.llm_model === "string" && settings.llm_model.trim()) ||
    process.env.LLM_MODEL ||
    config.defaultModel;

  const hasExplicitFallbackSetting =
    typeof settings?.llm_fallback_model === "string" || settings?.llm_fallback_model === null;

  const fallbackModel = hasExplicitFallbackSetting
    ? (typeof settings?.llm_fallback_model === "string" && settings.llm_fallback_model.trim()) || undefined
    : config.fallbackModel || undefined;

  // Per-provider key (e.g. MIMO_API_KEY) takes precedence over the generic LLM_API_KEY.
  const providerEnvKey = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[providerEnvKey] || process.env.LLM_API_KEY || "";

  if (!apiKey) {
    throw new Error(`Missing API key for provider "${provider}". Set the LLM_API_KEY environment variable.`);
  }

  return { provider, model, fallbackModel, apiKey, config };
}

export async function callLLM(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
  reasoning?: OpenRouterReasoningConfig;
}): Promise<LLMResult> {
  const { selection } = options;
  if (selection.config.native) {
    return callAnthropic(options);
  }
  try {
    return await callOpenAICompatible(options);
  } catch (error) {
    const fallback = selection.fallbackModel;
    if (fallback && fallback !== selection.model && !isAbortError(error)) {
      return callOpenAICompatible({
        ...options,
        selection: { ...selection, model: fallback },
      });
    }
    throw error;
  }
}

// ─── Streaming API ────────────────────────────────────────────────────────────

export async function* callLLMStream(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
  systemPromptParts?: { stable: string; dynamic: string };
  reasoning?: OpenRouterReasoningConfig;
}): AsyncGenerator<LLMStreamEvent> {
  if (options.selection.config.native) {
    // Anthropic: no streaming yet — emit full response as single chunk
    const result = await callAnthropic(options);
    if (result.content) yield { type: "text", chunk: result.content };
    yield {
      type: "done",
      content: result.content,
      toolCalls: result.toolCalls,
      reasoning: result.reasoning,
      reasoning_details: result.reasoning_details,
    };
    return;
  }

  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      yield* streamOpenAICompatibleBody(options);
      return;
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
      if (!isTransientError(error) || attempt >= maxRetries) {
        // Attempt fallback model (non-streaming)
        const fallback = options.selection.fallbackModel;
        if (fallback && fallback !== options.selection.model) {
          try {
            const result = await callOpenAICompatible({
              ...options,
              selection: { ...options.selection, model: fallback },
            });
            if (result.content) yield { type: "text", chunk: result.content };
            yield {
              type: "done",
              content: result.content,
              toolCalls: result.toolCalls,
              reasoning: result.reasoning,
              reasoning_details: result.reasoning_details,
            };
            return;
          } catch {
            // fallback also failed — fall through and throw original
          }
        }
        throw error;
      }
      const delayMs = isRateLimitError(error) ? Math.pow(2, attempt + 1) * 1_000 : 1_000;
      await sleepMs(delayMs, options.signal);
    }
  }
  throw lastError;
}

async function* streamOpenAICompatibleBody(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
  reasoning?: OpenRouterReasoningConfig;
}): AsyncGenerator<LLMStreamEvent> {
  const { selection, messages, tools = [], signal } = options;
  const url = `${selection.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  console.log("[LLM]", selection.provider, url, {
    authHeader: selection.config.apiKeyHeader ?? "Authorization",
    keyPrefix: selection.apiKey.slice(0, 8),
  });

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(selection.config.apiKeyHeader
        ? { [selection.config.apiKeyHeader]: selection.apiKey }
        : { Authorization: `Bearer ${selection.apiKey}` }),
      ...selection.config.extraHeaders,
    },
    body: JSON.stringify(buildOpenAICompatibleRequestBody({
      model: selection.model,
      messages,
      tools,
      stream: true,
      reasoning: options.reasoning,
      selection,
    })),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status}): ${await safeErrorText(response)}`);
  }

  const body = response.body;
  if (!body) throw new Error("Response body is null");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let fullContent = "";

  // Accumulate tool call deltas keyed by index
  const toolCallAcc = new Map<
    number,
    {
      id: string;
      name: string;
      args: string;
      extraContent?: {
        google?: {
          thought_signature?: string;
        };
      };
    }
  >();
  let reasoningText = "";
  let reasoningDetails: unknown[] = [];

  try {
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6).trim();
        if (data === "[DONE]") break outer;

        let parsed: unknown;
        try { parsed = JSON.parse(data); } catch { continue; }

        type SSEChunk = {
          choices?: Array<{
            delta?: {
              content?: string | null;
              reasoning?: string | null;
              reasoning_content?: string | null;
              reasoning_details?: unknown[] | null;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
                extra_content?: {
                  google?: {
                    thought_signature?: string;
                  };
                };
              }>;
            };
          }>;
        };

        const delta = (parsed as SSEChunk).choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullContent += delta.content;
          yield { type: "text", chunk: delta.content };
        }

        const deltaReasoning = normalizeReasoningText(delta.reasoning) || normalizeReasoningText(delta.reasoning_content);
        if (deltaReasoning) {
          reasoningText += deltaReasoning;
        }

        const deltaReasoningDetails = normalizeReasoningDetails(delta.reasoning_details);
        if (deltaReasoningDetails?.length) {
          reasoningDetails = reasoningDetails.concat(deltaReasoningDetails);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallAcc.has(idx)) {
              toolCallAcc.set(idx, {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                args: "",
                extraContent: normalizeToolCallExtraContent(tc.extra_content),
              });
            }
            const acc = toolCallAcc.get(idx)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
            const mergedExtra = normalizeToolCallExtraContent(tc.extra_content);
            if (mergedExtra?.google?.thought_signature) {
              acc.extraContent = mergedExtra;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const toolCalls: LLMToolCall[] = [];
  for (const [, acc] of toolCallAcc) {
    if (!acc.name) continue;
    let args: Record<string, unknown> = {};
    try { args = toObject(JSON.parse(acc.args)); } catch { }
    toolCalls.push({
      id: acc.id || crypto.randomUUID(),
      name: acc.name,
      arguments: args,
      extraContent: acc.extraContent,
    });
  }

  yield {
    type: "done",
    content: fullContent,
    toolCalls,
    reasoning: reasoningText || undefined,
    reasoning_details: reasoningDetails.length ? reasoningDetails : undefined,
  };
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && /\(429\)/.test(error.message);
}

function isTransientError(error: unknown): boolean {
  if (isRateLimitError(error)) return true;
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("fetch failed");
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

// ─── Existing helpers ─────────────────────────────────────────────────────────

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

async function callOpenAICompatible(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
  reasoning?: OpenRouterReasoningConfig;
}): Promise<LLMResult> {
  const { selection, messages, tools = [], signal } = options;
  const url = `${selection.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(selection.config.apiKeyHeader
        ? { [selection.config.apiKeyHeader]: selection.apiKey }
        : { Authorization: `Bearer ${selection.apiKey}` }),
      ...selection.config.extraHeaders,
    },
    body: JSON.stringify(buildOpenAICompatibleRequestBody({
      selection,
      model: selection.model,
      messages,
      tools,
      temperature: 0.4,
      reasoning: options.reasoning,
    })),
  });

  if (!response.ok) {
    throw new Error(
      `LLM request failed (${response.status}): ${await safeErrorText(response)}`,
    );
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content : "";
  const toolCalls = Array.isArray(message?.tool_calls)
    ? message.tool_calls
      .map(parseOpenAIToolCall)
      .filter((tool: LLMToolCall | null): tool is LLMToolCall => Boolean(tool))
    : [];
  const reasoning = normalizeReasoningText(message?.reasoning) || normalizeReasoningText(message?.reasoning_content);
  const reasoningDetails = normalizeReasoningDetails(message?.reasoning_details);

  return {
    content,
    toolCalls,
    reasoning,
    reasoning_details: reasoningDetails?.length ? reasoningDetails : undefined,
  };
}

async function callAnthropic(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
  systemPromptParts?: { stable: string; dynamic: string };
}): Promise<LLMResult> {
  const { selection, messages, tools = [], signal, systemPromptParts } = options;

  const useCaching = Boolean(systemPromptParts);
  let systemValue: unknown;
  let anthropicMessages: ReturnType<typeof toAnthropicPayload>["anthropicMessages"];

  if (systemPromptParts) {
    const { anthropicMessages: msgs } = toAnthropicPayload(messages);
    anthropicMessages = msgs;
    systemValue = [
      { type: "text", text: systemPromptParts.stable, cache_control: { type: "ephemeral" } },
      { type: "text", text: systemPromptParts.dynamic },
    ];
  } else {
    const payload = toAnthropicPayload(messages);
    anthropicMessages = payload.anthropicMessages;
    systemValue = payload.system;
  }

  const mappedTools = tools.map((tool, idx) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
    ...(useCaching && idx === tools.length - 1 ? { cache_control: { type: "ephemeral" } } : {}),
  }));

  const response = await fetch(`${selection.config.baseUrl.replace(/\/+$/, "")}/messages`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": selection.apiKey,
      "anthropic-version": "2023-06-01",
      ...(useCaching ? { "anthropic-beta": "prompt-caching-2024-07-31" } : {}),
    },
    body: JSON.stringify({
      model: selection.model,
      max_tokens: 1024,
      system: systemValue,
      messages: anthropicMessages,
      tools: mappedTools,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic request failed (${response.status}): ${await safeErrorText(response)}`,
    );
  }

  const data = await response.json();
  const contentBlocks = Array.isArray(data?.content) ? data.content : [];

  const textContent = contentBlocks
    .filter((block: { type?: string; text?: string }) => block.type === "text")
    .map((block: { text?: string }) => block.text || "")
    .join("");

  const toolCalls = contentBlocks
    .filter((block: { type?: string }) => block.type === "tool_use")
    .map((block: { id?: string; name?: string; input?: unknown }) => ({
      id: block.id || crypto.randomUUID(),
      name: block.name || "unknown_tool",
      arguments: toObject(block.input),
    }));

  return { content: textContent, toolCalls };
}

function parseOpenAIToolCall(toolCall: {
  id?: string;
  function?: { name?: string; arguments?: string };
  extra_content?: {
    google?: {
      thought_signature?: string;
    };
  };
}): LLMToolCall | null {
  if (!toolCall?.function?.name) {
    return null;
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = toolCall.function.arguments
      ? JSON.parse(toolCall.function.arguments)
      : {};
  } catch {
    parsed = {};
  }

  return {
    id: toolCall.id || crypto.randomUUID(),
    name: toolCall.function.name,
    arguments: toObject(parsed),
    extraContent: normalizeToolCallExtraContent(toolCall.extra_content),
  };
}

function buildOpenAICompatibleRequestBody(options: {
  selection: ProviderSelection;
  model: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  temperature?: number;
  stream?: boolean;
  reasoning?: OpenRouterReasoningConfig;
}): Record<string, unknown> {
  const { selection, model, messages, tools = [], temperature, stream, reasoning } = options;
  const body: Record<string, unknown> = {
    model,
    messages,
    tools: tools.length
      ? tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
      : undefined,
    tool_choice: tools.length ? "auto" : undefined,
    temperature,
    ...(stream ? { stream: true } : {}),
  };

  if (selection.provider === "openrouter" && reasoning?.enabled) {
    const capabilities = getOpenRouterReasoningCapabilities(model);
    if (!capabilities.supportsReasoningToggle) {
      return body;
    }

    body.reasoning = {
      enabled: true,
      ...(capabilities.supportsEffort && reasoning.effort ? { effort: reasoning.effort } : {}),
    };
  }

  return body;
}

function normalizeReasoningText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? value : undefined;
}

function normalizeReasoningDetails(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }

  return value;
}

function normalizeToolCallExtraContent(value: unknown): LLMToolCall["extraContent"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const googleRaw = record.google;
  if (!googleRaw || typeof googleRaw !== "object" || Array.isArray(googleRaw)) {
    return undefined;
  }

  const google = googleRaw as Record<string, unknown>;
  const thoughtSignature = typeof google.thought_signature === "string"
    ? google.thought_signature
    : undefined;

  if (!thoughtSignature) {
    return undefined;
  }

  return {
    google: {
      thought_signature: thoughtSignature,
    },
  };
}

function toAnthropicPayload(messages: LLMMessage[]): {
  system: string;
  anthropicMessages: Array<{
    role: "user" | "assistant";
    content:
    | string
    | Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      | { type: "tool_result"; tool_use_id: string; content: string }
    >;
  }>;
} {
  const systemParts: string[] = [];
  const anthropicMessages: Array<{
    role: "user" | "assistant";
    content:
    | string
    | Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      | { type: "tool_result"; tool_use_id: string; content: string }
    >;
  }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }

    if (message.role === "tool") {
      anthropicMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.tool_call_id || message.name || "tool_call",
            content: message.content,
          },
        ],
      });
      continue;
    }

    if (message.role === "assistant" && message.tool_calls?.length) {
      const blocks: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      > = [];
      if (message.content.trim()) {
        blocks.push({ type: "text", text: message.content });
      }
      for (const toolCall of message.tool_calls) {
        blocks.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input: toObject(safeJsonParse(toolCall.function.arguments)),
        });
      }
      anthropicMessages.push({ role: "assistant", content: blocks });
      continue;
    }

    anthropicMessages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    });
  }

  return {
    system: systemParts.join("\n\n").trim(),
    anthropicMessages,
  };
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function toObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "unknown error";
  }
}
