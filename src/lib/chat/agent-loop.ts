import type { AgentEvent, TaskPlan, TaskStep } from "@/lib/types/database";
import {
  callLLMStream,
  type LLMMessage,
  type LLMToolCall,
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
  idleTimeout?: number;
  maxErrors?: number;
  maxIterations?: number;
}

const DEFAULT_TIMEOUT_MS = 240_000;
const DEFAULT_IDLE_TIMEOUT_MS = 150_000;
const DEFAULT_MAX_ERRORS = 3;
const TOOL_RESULT_LIMIT = 8_000;
const PLAN_TASK_TOOL_NAME = "plan_task";

export async function* agentLoop(options: AgentLoopOptions): AsyncGenerator<AgentEvent> {
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const idleTimeoutMs = options.idleTimeout ?? DEFAULT_IDLE_TIMEOUT_MS;
  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
  const maxIterations =
    typeof options.maxIterations === "number" && options.maxIterations > 0
      ? Math.trunc(options.maxIterations)
      : null;
  const timeoutController = new AbortController();
  let timeoutReason: "hard" | "idle" | null = null;
  let idleTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const abortForTimeout = (reason: "hard" | "idle") => {
    if (timeoutReason) {
      return;
    }

    timeoutReason = reason;
    timeoutController.abort();
  };
  const timeoutHandle = setTimeout(() => {
    abortForTimeout("hard");
  }, timeoutMs);
  const markProgress = () => {
    if (timeoutController.signal.aborted) {
      return;
    }

    if (idleTimeoutHandle) {
      clearTimeout(idleTimeoutHandle);
    }

    idleTimeoutHandle = setTimeout(() => {
      abortForTimeout("idle");
    }, idleTimeoutMs);
  };
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
  let activePlan: TaskPlan | null = null;
  let currentStepIndex = 0;
  const completedStepTools = new Map<string, Set<string>>();
  let iterationCount = 0;
  let emptyResponseRecoveryAttempts = 0;
  let deferredActionRecoveryAttempts = 0;

  try {
    markProgress();

    while (true) {
      if (timeoutController.signal.aborted) {
        yield { type: "error", message: buildTimeoutMessage(timeoutReason, timeoutMs, idleTimeoutMs) };
        return;
      }

      try {
        if (maxIterations != null && iterationCount >= maxIterations) {
          yield { type: "error", message: "Agent reached its iteration limit before finishing." };
          return;
        }

        iterationCount += 1;
        markProgress();

        // Stream the LLM response, emitting text_delta events in real time.
        // iterationText tracks what was streamed this iteration only; it is
        // only moved into finalText if this turns out to be the terminal iteration.
        let rawContent = "";
        let apiToolCalls: LLMToolCall[] = [];
        let iterationText = "";
        const thinkFilter = createThinkFilter();

        for await (const streamEvent of callLLMStream({
          selection: options.provider,
          messages: buildMessagesForIteration(llmMessages, activePlan, currentStepIndex),
          tools: llmTools,
          signal: timeoutController.signal,
        })) {
          markProgress();
          if (streamEvent.type === "text") {
            rawContent += streamEvent.chunk;
            const emittable = thinkFilter.feed(streamEvent.chunk);
            if (emittable) {
              iterationText += emittable;
              yield { type: "text_delta", content: emittable };
            }
          } else if (streamEvent.type === "done") {
            apiToolCalls = streamEvent.toolCalls;
          }
        }

        // Flush any content held in the think buffer at end of stream
        const flushed = thinkFilter.flush();
        if (flushed) {
          iterationText += flushed;
          yield { type: "text_delta", content: flushed };
        }

        markProgress();

        const thinkingContent = summarizeThinkingForDisplay(rawContent);
        if (thinkingContent) {
          markProgress();
          yield { type: "thinking", content: thinkingContent };
        }
        const visibleContent = sanitizeAssistantContent(rawContent);
        const fallbackToolCalls =
          apiToolCalls.length === 0 ? parseProtocolToolCalls(rawContent) : [];
        const effectiveToolCalls =
          apiToolCalls.length > 0 ? apiToolCalls : fallbackToolCalls;

        if (!effectiveToolCalls.length) {
          if (!visibleContent.trim()) {
            if (emptyResponseRecoveryAttempts < 1) {
              emptyResponseRecoveryAttempts += 1;
              llmMessages.push({
                role: "system",
                content:
                  "Your previous turn did not contain any user-visible answer. " +
                  "Respond to the user now with a concise final message in plain markdown. " +
                  "Do not omit the final answer. Only call another tool if a required result is still missing.",
              });
              continue;
            }

            yield { type: "error", message: "Agent returned an empty response after processing the request." };
            return;
          }

          if (
            options.tools.length > 0 &&
            isDeferredToolIntentResponse(visibleContent) &&
            deferredActionRecoveryAttempts < 1
          ) {
            deferredActionRecoveryAttempts += 1;
            llmMessages.push({
              role: "system",
              content:
                "Your previous turn promised to use a tool but did not call it. " +
                "Call the tool now. Do not narrate — act.",
            });
            continue;
          }

          // This is the terminal iteration — commit streamed text to finalText.
          // If the think filter suppressed everything and sanitization recovered
          // content, emit it now (e.g. pure think-block responses).
          if (iterationText.trim()) {
            finalText += iterationText;
          } else if (visibleContent.trim()) {
            finalText += visibleContent;
            for (const chunk of chunkText(visibleContent, 140)) {
              markProgress();
              yield { type: "text_delta", content: chunk };
            }
          }

          yield { type: "done", content: finalText.trim() };
          return;
        }

        emptyResponseRecoveryAttempts = 0;
        deferredActionRecoveryAttempts = 0;

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
          const callId = call.id;
          const matchedStep =
            call.name === PLAN_TASK_TOOL_NAME
              ? null
              : findStepForToolCall(activePlan, currentStepIndex, call.name);

          if (activePlan && matchedStep) {
            const matchedIndex = activePlan.steps.findIndex((step) => step.id === matchedStep.id);
            if (matchedIndex >= 0) {
              currentStepIndex = matchedIndex;
            }

            if (matchedStep.status !== "running") {
              matchedStep.status = "running";
              markProgress();
              yield { type: "step_started", stepId: matchedStep.id, planId: activePlan.id };
            }
          }

          markProgress();
          yield { type: "tool_call", name: call.name, args: call.arguments, callId };

          markProgress();
          const tool = toolMap.get(call.name);
          const toolStart = Date.now();
          const toolResult = await runTool(tool, call.arguments, timeoutController.signal);
          const durationMs = Date.now() - toolStart;
          const sanitized = sanitizeToolResult(toolResult);
          const truncated = toolResult.trim().length > TOOL_RESULT_LIMIT;

          markProgress();
          yield { type: "tool_result", name: call.name, result: sanitized, callId, durationMs, truncated };
          llmMessages.push({
            role: "tool",
            name: call.name,
            tool_call_id: call.id,
            content: sanitized,
          });

          if (call.name === PLAN_TASK_TOOL_NAME) {
            const parsedPlan = parseTaskPlanResult(toolResult);
            if (parsedPlan) {
              activePlan = parsedPlan;
              currentStepIndex = findNextOpenStepIndex(parsedPlan);
              completedStepTools.clear();
              markProgress();
              yield { type: "plan_created", plan: clonePlan(parsedPlan) };
            }
            continue;
          }

          if (!activePlan || !matchedStep) {
            continue;
          }

          if (didToolFail(toolResult)) {
            matchedStep.status = "failed";
            markProgress();
            yield {
              type: "step_failed",
              stepId: matchedStep.id,
              planId: activePlan.id,
              error: sanitized,
            };
            continue;
          }

          markStepToolCompleted(completedStepTools, matchedStep, call.name);
          if (isStepComplete(matchedStep, completedStepTools)) {
            matchedStep.status = "done";
            markProgress();
            yield {
              type: "step_completed",
              stepId: matchedStep.id,
              planId: activePlan.id,
              result: sanitized,
            };

            currentStepIndex = findNextOpenStepIndex(activePlan, currentStepIndex + 1);
            if (activePlan.steps.every((step) => step.status === "done")) {
              activePlan = null;
              currentStepIndex = 0;
              completedStepTools.clear();
            }
          }
        }

        consecutiveErrors = 0;
      } catch (error) {
        if (timeoutController.signal.aborted || isAbortError(error)) {
          yield { type: "error", message: buildTimeoutMessage(timeoutReason, timeoutMs, idleTimeoutMs) };
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
        markProgress();

        if (consecutiveErrors >= maxErrors) {
          yield { type: "error", message: `Agent stopped after ${consecutiveErrors} errors: ${message}` };
          return;
        }
      }
    }
  } finally {
    clearTimeout(timeoutHandle);
    if (idleTimeoutHandle) {
      clearTimeout(idleTimeoutHandle);
    }
  }
}

function buildMessagesForIteration(
  llmMessages: LLMMessage[],
  activePlan: TaskPlan | null,
  currentStepIndex: number,
): LLMMessage[] {
  if (!activePlan) {
    return llmMessages;
  }

  const currentStep =
    activePlan.steps[currentStepIndex] ??
    activePlan.steps.find((step) => step.status === "running" || step.status === "pending");

  if (!currentStep) {
    return llmMessages;
  }

  return [
    ...llmMessages,
    {
      role: "system",
      content: buildPlanExecutionPrompt(activePlan, currentStep),
    },
  ];
}

function buildPlanExecutionPrompt(plan: TaskPlan, currentStep: TaskStep): string {
  const remaining = plan.steps
    .filter((step) => step.status !== "done")
    .map((step, index) => {
      const toolText = step.toolsNeeded?.length
        ? ` Tools: ${step.toolsNeeded.join(", ")}.`
        : "";
      return `${index + 1}. [${step.status}] ${step.title}: ${step.description}.${toolText}`;
    })
    .join("\n");

  return [
    "You are currently executing a multi-step plan.",
    plan.goal ? `Goal: ${plan.goal}` : null,
    `Current step: ${currentStep.title}`,
    currentStep.toolsNeeded?.length
      ? `Expected tools for this step: ${currentStep.toolsNeeded.join(", ")}`
      : "Advance the current step with the next useful tool call.",
    remaining ? `Open steps:\n${remaining}` : null,
    "Proceed with the next action for the current step before moving on.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseTaskPlanResult(result: string): TaskPlan | null {
  try {
    const parsed = JSON.parse(result) as Partial<TaskPlan> & { goal?: unknown; steps?: unknown };
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) {
      return null;
    }

    const steps = parsed.steps
      .map((step) => normalizeTaskStep(step))
      .filter((step): step is TaskStep => Boolean(step));

    if (!steps.length) {
      return null;
    }

    return {
      id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : crypto.randomUUID(),
      goal: typeof parsed.goal === "string" ? parsed.goal : undefined,
      steps,
    };
  } catch {
    return null;
  }
}

function normalizeTaskStep(step: unknown): TaskStep | null {
  if (!step || typeof step !== "object") {
    return null;
  }

  const record = step as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const description = typeof record.description === "string" ? record.description.trim() : "";
  if (!title || !description) {
    return null;
  }

  const status =
    record.status === "running" ||
    record.status === "done" ||
    record.status === "failed" ||
    record.status === "pending"
      ? record.status
      : "pending";
  const toolsNeeded = Array.isArray(record.toolsNeeded)
    ? record.toolsNeeded
        .filter((tool): tool is string => typeof tool === "string")
        .map((tool) => tool.trim())
        .filter(Boolean)
    : undefined;

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id : crypto.randomUUID(),
    title,
    description,
    status,
    ...(toolsNeeded?.length ? { toolsNeeded } : {}),
  };
}

function findStepForToolCall(
  activePlan: TaskPlan | null,
  currentStepIndex: number,
  toolName: string,
): TaskStep | null {
  if (!activePlan) {
    return null;
  }

  const orderedSteps = [
    ...activePlan.steps.slice(currentStepIndex),
    ...activePlan.steps.slice(0, currentStepIndex),
  ].filter(isOpenStep);
  const matchedByTool = orderedSteps.find((step) => step.toolsNeeded?.includes(toolName));
  if (matchedByTool) {
    return matchedByTool;
  }

  return orderedSteps.find((step) => !step.toolsNeeded?.length) || null;
}

function isOpenStep(step: TaskStep): boolean {
  return step.status === "pending" || step.status === "running" || step.status === "failed";
}

function markStepToolCompleted(
  stepTools: Map<string, Set<string>>,
  step: TaskStep,
  toolName: string,
): void {
  const tools = stepTools.get(step.id) || new Set<string>();
  tools.add(toolName);
  stepTools.set(step.id, tools);
}

function isStepComplete(
  step: TaskStep,
  stepTools: Map<string, Set<string>>,
): boolean {
  if (!step.toolsNeeded?.length) {
    return true;
  }

  const executed = stepTools.get(step.id);
  if (!executed) {
    return false;
  }

  return step.toolsNeeded.every((tool) => executed.has(tool));
}

function findNextOpenStepIndex(plan: TaskPlan, startAt = 0): number {
  const nextIndex = plan.steps.findIndex(
    (step, index) => index >= startAt && step.status !== "done",
  );
  if (nextIndex >= 0) {
    return nextIndex;
  }

  return plan.steps.findIndex((step) => step.status !== "done");
}

function didToolFail(result: string): boolean {
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

function clonePlan(plan: TaskPlan): TaskPlan {
  return {
    id: plan.id,
    goal: plan.goal,
    steps: plan.steps.map((step) => ({
      ...step,
      ...(step.toolsNeeded ? { toolsNeeded: [...step.toolsNeeded] } : {}),
    })),
  };
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

function buildTimeoutMessage(
  reason: "hard" | "idle" | null,
  timeoutMs: number,
  idleTimeoutMs: number,
): string {
  if (reason === "idle") {
    return `Agent timed out after ${formatDurationForMessage(idleTimeoutMs)} without progress.`;
  }

  return `Agent timed out after ${formatDurationForMessage(timeoutMs)} of total runtime.`;
}

function formatDurationForMessage(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds} seconds`;
  }

  const minutes = totalSeconds / 60;
  if (Number.isInteger(minutes)) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${minutes.toFixed(1)} minutes`;
}

// ─── Think-block stream filter ────────────────────────────────────────────────
// Buffers content at the start of a response to detect and suppress <think>…</think>
// blocks. Once we know we're past any think block, content flows through directly.

interface ThinkFilter {
  feed(chunk: string): string;
  flush(): string;
}

function createThinkFilter(): ThinkFilter {
  type Phase = "detecting" | "in_think" | "streaming";
  let phase: Phase = "detecting";
  let buf = "";
  const THINK_OPEN = "<think>";
  const THINK_CLOSE = "</think>";

  function feed(chunk: string): string {
    if (phase === "streaming") return chunk;

    buf += chunk;

    if (phase === "in_think") {
      const end = buf.toLowerCase().indexOf(THINK_CLOSE);
      if (end !== -1) {
        const after = buf.slice(end + THINK_CLOSE.length);
        buf = "";
        phase = "streaming";
        return after;
      }
      return "";
    }

    // "detecting" — buffer until we can tell if it starts with <think>
    const trimmed = buf.trimStart();
    if (trimmed.length < THINK_OPEN.length) return ""; // not enough data yet

    if (trimmed.toLowerCase().startsWith(THINK_OPEN)) {
      phase = "in_think";
      const end = buf.toLowerCase().indexOf(THINK_CLOSE);
      if (end !== -1) {
        const after = buf.slice(end + THINK_CLOSE.length);
        buf = "";
        phase = "streaming";
        return after;
      }
      return "";
    }

    // Doesn't start with <think> — flush and stream
    phase = "streaming";
    const out = buf;
    buf = "";
    return out;
  }

  function flush(): string {
    if (phase === "streaming") return "";
    if (phase === "detecting" && buf) {
      // Response ended before we accumulated enough to detect — emit as-is
      const out = buf;
      buf = "";
      return out;
    }
    // phase === "in_think" and never closed — suppress (it's all think content)
    buf = "";
    return "";
  }

  return { feed, flush };
}

// ─── Text chunking ────────────────────────────────────────────────────────────

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

function extractThinkingContent(text: string): string | null {
  if (!text) return null;
  const match = text.match(/<think>([\s\S]*?)<\/think>/i);
  return match?.[1]?.trim() || null;
}

function summarizeThinkingForDisplay(text: string): string | null {
  const rawThinking = extractThinkingContent(text);
  if (!rawThinking) {
    return null;
  }

  const normalized = rawThinking.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/\b(system prompt|instructions|runtime context|provided in the prompt|my instructions)\b/.test(normalized)) {
    return "Reviewing the request and preparing a response.";
  }

  if (/\bweb_search|search\b|\bresearch\b|\bsources?\b|\bcompare\b/.test(normalized)) {
    return "Researching sources and gathering results.";
  }

  if (/\bcalendar\b|\bschedule\b|\bmeeting\b|\bevent\b/.test(normalized)) {
    return "Checking scheduling details and next steps.";
  }

  if (/\bmemory\b|\bremember\b|\bpreferences?\b/.test(normalized)) {
    return "Reviewing relevant memory and user context.";
  }

  if (/\bemail\b|\bdraft\b|\bwrite\b|\breply\b/.test(normalized)) {
    return "Drafting the response.";
  }

  if (/\btool\b|\bcall\b|\bfunction\b/.test(normalized)) {
    return "Choosing the next action.";
  }

  return "Analyzing the request and deciding the next step.";
}

function isDeferredToolIntentResponse(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return [
    /\blet me (search|check|look up|find|fetch|research|compare|dig deeper)\b/,
    /\bi(?:'ll| will) (search|check|look up|find|fetch|research|compare)\b/,
    /\bi(?:'m| am) going to (search|check|look up|find|fetch|research|compare)\b/,
    /\bsearch for\b/,
    /\bcheck for\b/,
    /\blook up\b/,
    /\bdig deeper\b/,
  ].some((pattern) => pattern.test(normalized));
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
  output = output.replace(/(?:^|\n)[^\n]*TOOL_(?:CALL|RESULT)[^\n]*(?=\n|$)/gi, "\n");
  output = output.replace(/(?:^|\n)\s*\{?\s*(?:tool|name)\s*=>[\s\S]*$/gim, "\n");
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
