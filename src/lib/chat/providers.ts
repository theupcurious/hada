import type { LLMProviderName, UserSettings } from "@/lib/types/database";

export interface ProviderConfig {
  baseUrl: string;
  defaultModel: string;
  apiKeyEnv: string;
  native?: boolean;
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
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface LLMResult {
  content: string;
  toolCalls: LLMToolCall[];
}

export const PROVIDERS: Record<LLMProviderName, ProviderConfig> = {
  minimax: {
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M2.1",
    apiKeyEnv: "MINIMAX_API_KEY",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5-20250929",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    native: true,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
  },
  kimi: {
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-auto",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b",
    apiKeyEnv: "GROQ_API_KEY",
  },
};

export interface ProviderSelection {
  provider: LLMProviderName;
  model: string;
  apiKey: string;
  config: ProviderConfig;
}

export function resolveProviderSelection(settings?: UserSettings): ProviderSelection {
  const preferred = String(
    settings?.llm_provider || process.env.LLM_PROVIDER || "minimax",
  ).toLowerCase() as LLMProviderName;
  const provider = PROVIDERS[preferred] ? preferred : "minimax";
  const config = PROVIDERS[provider];

  const model =
    (typeof settings?.llm_model === "string" && settings.llm_model.trim()) ||
    config.defaultModel;

  const apiKey =
    process.env[config.apiKeyEnv] ||
    process.env.LLM_API_KEY ||
    (provider === "kimi" ? process.env.KIMI_API_KEY : undefined) ||
    "";

  if (!apiKey) {
    throw new Error(`Missing API key for provider "${provider}" (${config.apiKeyEnv}).`);
  }

  return { provider, model, apiKey, config };
}

export async function callLLM(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
}): Promise<LLMResult> {
  const { selection } = options;
  if (selection.config.native) {
    return callAnthropic(options);
  }
  return callOpenAICompatible(options);
}

async function callOpenAICompatible(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
}): Promise<LLMResult> {
  const { selection, messages, tools = [], signal } = options;
  const url = `${selection.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${selection.apiKey}`,
    },
    body: JSON.stringify({
      model: selection.model,
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
      temperature: 0.4,
    }),
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

  return { content, toolCalls };
}

async function callAnthropic(options: {
  selection: ProviderSelection;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
}): Promise<LLMResult> {
  const { selection, messages, tools = [], signal } = options;
  const { system, anthropicMessages } = toAnthropicPayload(messages);

  const response = await fetch(`${selection.config.baseUrl.replace(/\/+$/, "")}/messages`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": selection.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: selection.model,
      max_tokens: 1024,
      system,
      messages: anthropicMessages,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      })),
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
