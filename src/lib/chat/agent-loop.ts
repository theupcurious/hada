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
  execute: (args: Record<string, unknown>) => Promise<string>;
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

  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      yield { type: "error", message: "Agent timed out before finishing the response." };
      return;
    }

    try {
      const result = await callLLM({
        selection: options.provider,
        messages: llmMessages,
        tools: llmTools,
      });

      const rawContent = result.content || "";
      const visibleContent = sanitizeAssistantContent(rawContent);
      const fallbackToolCalls =
        result.toolCalls.length === 0 ? parseProtocolToolCalls(rawContent) : [];
      const effectiveToolCalls =
        result.toolCalls.length > 0 ? result.toolCalls : fallbackToolCalls;

      if (visibleContent) {
        finalText += visibleContent;
        for (const chunk of chunkText(visibleContent, 140)) {
          yield { type: "text_delta", content: chunk };
        }
      }

      if (!effectiveToolCalls.length) {
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
        const toolResult = await runTool(tool, call.arguments);
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
      consecutiveErrors += 1;
      const message =
        error instanceof Error ? error.message : "Unknown error while running agent loop.";

      llmMessages.push({
        role: "tool",
        name: "runtime_error",
        content: `Runtime error: ${message}`,
      });

      if (consecutiveErrors >= maxErrors) {
        yield { type: "error", message: `Agent stopped after ${consecutiveErrors} errors: ${message}` };
        return;
      }
    }
  }
}

function parseProtocolToolCalls(
  content: string,
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  if (!content) {
    return [];
  }

  const calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
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
    calls.push({
      id: `toolcall_${crypto.randomUUID()}`,
      name,
      arguments: args,
    });
  }

  return calls;
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
): Promise<string> {
  if (!tool) {
    return "Tool not found.";
  }

  try {
    return await tool.execute(args);
  } catch (error) {
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

  // Clean up common parameter markers leaked by some providers.
  output = output.replace(/<!--\$[^>]+-->/g, "");
  output = output.replace(/<\/?parameter>/gi, "");
  output = normalizeMarkdownTables(output);
  output = output.replace(/\n{3,}/g, "\n\n");

  return output.trim();
}

function normalizeMarkdownTables(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!isPotentialTableLine(lines[i]) || i + 1 >= lines.length || !isTableSeparatorLine(lines[i + 1])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const tableLines: string[] = [lines[i], lines[i + 1]];
    i += 2;
    while (i < lines.length && isPotentialTableLine(lines[i])) {
      tableLines.push(lines[i]);
      i += 1;
    }

    const normalized = tableToBullets(tableLines);
    out.push(normalized);
  }

  return out.join("\n");
}

function isPotentialTableLine(line: string): boolean {
  return line.includes("|");
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) {
    return false;
  }

  const cells = parseTableRow(trimmed);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function tableToBullets(lines: string[]): string {
  if (lines.length < 3) {
    return lines.join("\n");
  }

  const header = parseTableRow(lines[0]);
  const dataRows = lines.slice(2).map(parseTableRow).filter((row) => row.some((cell) => cell.length > 0));

  if (!dataRows.length) {
    return "";
  }

  const hasUsefulHeader = header.some((cell) => cell.length > 0);
  if (dataRows.every((row) => row.length >= 2)) {
    return dataRows
      .map((row) => {
        const left = row[0];
        const right = row.slice(1).join(" | ");
        if (!hasUsefulHeader || left) {
          return `- ${left || "Value"}: ${right}`;
        }
        return `- ${right}`;
      })
      .join("\n");
  }

  return dataRows.map((row) => `- ${row.join(" | ")}`).join("\n");
}
