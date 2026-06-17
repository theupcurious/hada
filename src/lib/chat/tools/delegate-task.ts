import type { AgentTool } from "@/lib/chat/agent-loop";
import { agentLoop } from "@/lib/chat/agent-loop";
import { createGoogleCalendarTools } from "@/lib/chat/tools/google-calendar";
import { createRecallMemoryTool } from "@/lib/chat/tools/recall-memory";
import { createSaveMemoryTool } from "@/lib/chat/tools/save-memory";
import { createScheduleTaskTool } from "@/lib/chat/tools/schedule-task";
import { createWebFetchTool } from "@/lib/chat/tools/web-fetch";
import { createWebSearchTool } from "@/lib/chat/tools/web-search";
import type { ToolContext } from "@/lib/chat/tools/types";
import { resolveProviderSelection, type ProviderSelection, type LLMMessage } from "@/lib/chat/providers";
import type { AgentEvent } from "@/lib/types/database";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import {
  buildSubAgentSystemPrompt,
  getSubAgentProfile,
  type SubAgentProfile,
} from "@/lib/chat/agents/profiles";

export const delegateTaskManifest: ToolManifest = {
  name: "delegate_task",
  displayName: "Delegate Task",
  description: "Delegate a focused task to a specialized sub-agent.",
  category: "system",
  riskLevel: "medium",
  parameters: {
    type: "object",
    properties: {
      agent: {
        type: "string",
        enum: ["researcher", "memory_manager", "scheduler"],
        description: "Which sub-agent to delegate to.",
      },
      task: {
        type: "string",
        description: "Clear description of what the sub-agent should accomplish.",
      },
      context: {
        type: "string",
        description: "Additional context from the conversation to pass along.",
      },
    },
    required: ["agent", "task"],
  },
};

type DelegationEvent = AgentEvent & {
  agentName?: string;
};

type DelegationToolContext = ToolContext & {
  onEvent?: (event: DelegationEvent) => Promise<void> | void;
  availableTools?: AgentTool[];
};

export function createDelegateTaskTool(context: ToolContext): AgentTool {
  const delegationContext = context as DelegationToolContext;

  return {
    name: delegateTaskManifest.name,
    description: delegateTaskManifest.description,
    parameters: delegateTaskManifest.parameters,
    async execute(args) {
      const agentName = String(args.agent || "").trim();
      const task = String(args.task || "").trim();
      const extraContext = typeof args.context === "string" ? args.context.trim() : "";

      if (!agentName || !task) {
        return JSON.stringify({ success: false, error: "agent and task are required" });
      }

      const profile = getSubAgentProfile(agentName);
      if (!profile) {
        return JSON.stringify({ success: false, error: `Unknown sub-agent: ${agentName}` });
      }

      const tools = selectAllowedTools(delegationContext, profile);
      if (!tools.length) {
        return JSON.stringify({
          success: false,
          error: `No tools available for sub-agent "${agentName}".`,
        });
      }

      const provider = resolveDelegationProvider(profile);
      const messages: LLMMessage[] = [
        {
          role: "user",
          content: buildDelegationUserMessage(task, extraContext),
        },
      ];
      const systemPrompt = buildSubAgentSystemPrompt(profile, task, extraContext || undefined);
      const onEvent = delegationContext.onEvent;

      await emitDelegationEvent(onEvent, {
        type: "delegation_started",
        agentName: profile.name,
        task,
      });

      try {
        let finalText = "";
        let terminalError: string | null = null;

        for await (const event of agentLoop({
          messages,
          systemPrompt,
          tools,
          provider,
          timeout: profile.timeout,
          idleTimeout: profile.idleTimeout,
          maxErrors: 2,
          maxIterations: profile.maxIterations,
        })) {
          if (event.type === "text_delta") {
            finalText += event.content;
          } else if (event.type === "done" && !finalText.trim()) {
            finalText = event.content;
          } else if (event.type === "error") {
            terminalError = event.message;
          }

          await emitDelegationEvent(onEvent, tagDelegationEvent(event, profile.name));
        }

        const output = finalText.trim();
        if (terminalError) {
          await emitDelegationEvent(onEvent, {
            type: "delegation_completed",
            agentName: profile.name,
            result: terminalError,
          });
          return JSON.stringify({ success: false, error: terminalError });
        }

        await emitDelegationEvent(onEvent, {
          type: "delegation_completed",
          agentName: profile.name,
          result: output,
        });

        return output || `Delegated task completed by ${profile.displayName}.`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Delegated task failed for ${profile.displayName}.`;

        await emitDelegationEvent(onEvent, {
          type: "delegation_completed",
          agentName: profile.name,
          result: message,
        });

        return JSON.stringify({ success: false, error: message });
      }
    },
  };
}

function resolveDelegationProvider(profile: SubAgentProfile): ProviderSelection {
  const settings =
    profile.provider || profile.model
      ? {
          llm_provider: profile.provider,
          llm_model: profile.model || null,
        }
      : undefined;

  return resolveProviderSelection(settings);
}

function selectAllowedTools(
  context: DelegationToolContext,
  profile: SubAgentProfile,
): AgentTool[] {
  const pool = context.availableTools?.length ? context.availableTools : buildFallbackToolPool(context);
  const allowed = new Set(profile.allowedTools);
  return pool.filter((tool) => allowed.has(tool.name) && tool.name !== delegateTaskManifest.name);
}

function buildFallbackToolPool(context: ToolContext): AgentTool[] {
  return [
    createSaveMemoryTool(context),
    createRecallMemoryTool(context),
    createScheduleTaskTool(context),
    createWebSearchTool(context),
    createWebFetchTool(),
    ...createGoogleCalendarTools(context),
  ];
}

function buildDelegationUserMessage(task: string, extraContext: string): string {
  return extraContext
    ? `Task:\n${task}\n\nContext:\n${extraContext}`
    : `Task:\n${task}`;
}

function tagDelegationEvent(event: AgentEvent, agentName: string): DelegationEvent {
  return { ...event, agentName };
}

async function emitDelegationEvent(
  callback: DelegationToolContext["onEvent"],
  event: DelegationEvent,
): Promise<void> {
  if (!callback) {
    return;
  }

  try {
    await callback(event);
  } catch {
    // Delegation telemetry should not break the sub-agent tool result.
  }
}
