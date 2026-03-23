import type { AgentEvent } from "@/lib/types/database";
import {
  callLLM,
  type LLMMessage,
  type LLMToolDefinition,
  type ProviderSelection,
} from "@/lib/chat/providers";

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<string>;
}

export interface AgentLoopOptions {
  messages: LLMMessage[];
  systemPrompt: string;
  tools: AgentTool[];
  provider: ProviderSelection;
  timeout?: number;
  maxErrors?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ERRORS = 3;
const TOOL_RESULT_LIMIT = 8_000;

export async function* agentLoop(options: AgentLoopOptions): AsyncGenerator<AgentEvent> {
  const startedAt = Date.now();
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);
  const toolMap = new Map(options.tools.map((tool) => [tool.name, tool]));
  const llmMessages: LLMMessage[] = [
    { role: "system", content: options.systemPrompt },
    ...options.messages,
  ];
  const llmTools: LLMToolDefinition[] = options.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  let consecutiveErrors = 0;
  let finalText = "";

  try {
    while (true) {
      if (timeoutController.signal.aborted || Date.now() - startedAt > timeoutMs) {
        yield { type: "error", message: "Agent timed out before finishing the response." };
        return;
      }

      try {
        const result = await callLLMWithRetry({
          selection: options.provider,
          messages: llmMessages,
          tools: llmTools,
          signal: timeoutController.signal,
        });

        const rawContent = result.content || "";
        const visibleContent = sanitizeAssistantContent(rawContent);
        const fallbackToolCalls =
          result.toolCalls.length === 0 ? parseProtocolToolCalls(rawContent) : [];
        const effectiveToolCalls =
          result.toolCalls.length > 0 ? result.toolCalls : fallbackToolCalls;

        if (!effectiveToolCalls.length) {
          if (visibleContent) {
            finalText += visibleContent;
            for (const chunk of chunkText(visibleContent, 140)) {
              yield { type: "text_delta", content: chunk };
            }
          }

          yield { type: "done", content: finalText.trim() };
          return;
        }

        llmMessages.push({
          role: "assistant",
          content: visibleContent,
          tool_calls: effectiveToolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments),
            },
          })),
        });

        for (const call of effectiveToolCalls) {
          yield { type: "tool_call", name: call.name, args: call.arguments };

          const tool = toolMap.get(call.name);
          const toolResult = await runTool(tool, call.arguments, timeoutController.signal);
          const sanitized = sanitizeToolResult(toolResult);

          yield { type: "tool_result", name: call.name, result: sanitized };
          llmMessages.push({
            role: "tool",
            name: call.name,
            tool_call_id: call.id,
            content: sanitized,
          });
        }

        consecutiveErrors = 0;
      } catch (error) {
        if (timeoutController.signal.aborted || isAbortError(error)) {
          yield { type: "error", message: "Agent timed out before finishing the response." };
          return;
        }

        consecutiveErrors += 1;
        const message =
          error instanceof Error ? error.message : "Unknown error while running agent loop.";

        llmMessages.push({
          role: "system",
          content:
            `The previous attempt failed with a runtime error: ${message}. ` +
            "Continue from the existing conversation state. If a tool is still needed, call it again explicitly.",
        });

        if (consecutiveErrors >= maxErrors) {
          yield { type: "error", message: `Agent stopped after ${consecutiveErrors} errors: ${message}` };
          return;
        }
      }
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function parseProtocolToolCalls(
  content: string,
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  if (!content) {
    return [];
  }

  const calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
  const seen = new Set<string>();

  const pushCall = (name: string, args: Record<string, unknown>) => {
    const key = `${name}:${JSON.stringify(args)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    calls.push({
      id: `toolcall_${crypto.randomUUID()}`,
      name,
      arguments: args,
    });
  };

  const blockRegex = /\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const block = blockMatch[1] || "";
    const nameMatch =
      block.match(/(?:tool|name)\s*[:=]>\s*["']?([a-zA-Z0-9_-]+)["']?/i) ||
      block.match(/(?:tool|name)\s*:\s*["']?([a-zA-Z0-9_-]+)["']?/i);
    const name = nameMatch?.[1];
    if (!name) {
      continue;
    }

    const args = extractProtocolArgs(block);
    pushCall(name, args);
  }

  const xmlBlockRegex = /<tool_calls>([\s\S]*?)<\/tool_calls>/gi;
  let xmlMatch: RegExpExecArray | null;
  while ((xmlMatch = xmlBlockRegex.exec(content)) !== null) {
    const block = xmlMatch[1] || "";
    for (const rawJson of extractJsonObjects(block)) {
      try {
        const parsed = safeJsonParse(rawJson);
        const name = typeof parsed?.name === "string" ? parsed.name : "";
        if (!name) {
          continue;
        }
        const argumentsValue =
          typeof parsed.arguments === "string"
            ? safeJsonParse(parsed.arguments)
            : parsed.arguments;
        pushCall(name, toObject(argumentsValue));
      } catch {
        // Ignore malformed tool-call snippets.
      }
    }
  }

  return calls;
}

function extractJsonObjects(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (ch === "}") {
      if (depth === 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0 && start !== -1) {
        results.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return results;
}

function extractProtocolArgs(block: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const argsBodyMatch = block.match(/args\s*[:=]>\s*\{([\s\S]*?)\}/i);
  const argsBody = argsBodyMatch?.[1] || block;

  const parameterMarkerRegex = /<!--\$(\w+)-->\s*([^<\n]+)\s*<\/parameter>/gi;
  let markerMatch: RegExpExecArray | null;
  while ((markerMatch = parameterMarkerRegex.exec(argsBody)) !== null) {
    args[markerMatch[1]] = markerMatch[2].trim();
  }

  const kvRegex = /(\w+)\s*[:=]>\s*["']([^"']+)["']/g;
  let kvMatch: RegExpExecArray | null;
  while ((kvMatch = kvRegex.exec(argsBody)) !== null) {
    if (!(kvMatch[1] in args)) {
      args[kvMatch[1]] = kvMatch[2];
    }
  }

  if (Object.keys(args).length > 0) {
    return args;
  }

  if (/<--\$\s*query\s*-->/.test(argsBody) || /weather/i.test(argsBody)) {
    const weatherQuery = argsBody
      .replace(/<!--\$\w+-->/g, " ")
      .replace(/<\/?parameter>/gi, " ")
      .replace(/[{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (weatherQuery) {
      return { query: weatherQuery };
    }
  }

  return {};
}

async function runTool(
  tool: AgentTool | undefined,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  if (!tool) {
    return "Tool not found.";
  }

  try {
    return await tool.execute(args, { signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return error instanceof Error ? `Tool error: ${error.message}` : "Tool error.";
  }
}

function sanitizeToolResult(result: string): string {
  const trimmed = result.trim();
  if (trimmed.length <= TOOL_RESULT_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, TOOL_RESULT_LIMIT)}\n\n[tool result truncated]`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
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

async function callLLMWithRetry(
  options: Parameters<typeof callLLM>[0],
  maxRetries = 2,
): Promise<Awaited<ReturnType<typeof callLLM>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callLLM(options);
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
      if (!isTransientError(error) || attempt >= maxRetries) throw error;
      const delayMs = isRateLimitError(error)
        ? Math.pow(2, attempt + 1) * 1_000 // 2s, 4s
        : 1_000;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        const signal = options.signal;
        if (signal) {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          };
          if (signal.aborted) {
            onAbort();
          } else {
            signal.addEventListener("abort", onAbort, { once: true });
          }
        }
      });
    }
  }
  throw lastError;
}

function chunkText(text: string, maxChunkSize: number): string[] {
  if (!text) return [];
  if (text.length <= maxChunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxChunkSize));
    start += maxChunkSize;
  }
  return chunks;
}

function sanitizeAssistantContent(text: string): string {
  if (!text) {
    return "";
  }

  let output = text;

  // Hide model reasoning and raw tool protocol text.
  output = output.replace(/<think>[\s\S]*?<\/think>/gi, "");
  output = output.replace(/<think>[\s\S]*$/gi, "");
  output = output.replace(/<\/?think>/gi, "");
  output = output.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, "");
  output = output.replace(/\[TOOL_RESULT\][\s\S]*?\[\/TOOL_RESULT\]/gi, "");
  output = output.replace(/\[TOOL_CALL\][\s\S]*$/gi, "");
  output = output.replace(/\[TOOL_RESULT\][\s\S]*$/gi, "");
  output = output.replace(/<tool_calls>[\s\S]*?<\/tool_calls>/gi, "");
  output = output.replace(/<tool_calls>[\s\S]*$/gi, "");

  // Clean up common parameter markers leaked by some providers.
  output = output.replace(/<!--\$[^>]+-->/g, "");
  output = output.replace(/<\/?parameter>/gi, "");
  output = output.replace(/\n{3,}/g, "\n\n");

  return output.trim();
}

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return toObject(parsed);
  } catch {
    return {};
  }
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
