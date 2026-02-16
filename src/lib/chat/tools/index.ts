import type { AgentTool } from "@/lib/chat/agent-loop";
import { createGoogleCalendarTools } from "@/lib/chat/tools/google-calendar";
import { createRecallMemoryTool } from "@/lib/chat/tools/recall-memory";
import { createSaveMemoryTool } from "@/lib/chat/tools/save-memory";
import { createScheduleTaskTool } from "@/lib/chat/tools/schedule-task";
import type { ToolContext } from "@/lib/chat/tools/types";
import { createWebFetchTool } from "@/lib/chat/tools/web-fetch";
import { createWebSearchTool } from "@/lib/chat/tools/web-search";

export interface CreateToolsOptions {
  connectedIntegrations?: string[];
}

export function createTools(
  context: ToolContext,
  options: CreateToolsOptions = {},
): AgentTool[] {
  const integrations = new Set(options.connectedIntegrations || []);
  const tools: AgentTool[] = [
    createSaveMemoryTool(context),
    createRecallMemoryTool(context),
    createScheduleTaskTool(context),
    createWebSearchTool(),
    createWebFetchTool(),
  ];

  if (integrations.has("google")) {
    tools.push(...createGoogleCalendarTools(context));
  }

  return tools;
}

export function summarizeToolList(tools: AgentTool[]): string {
  if (!tools.length) {
    return "No tools available.";
  }

  return tools
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join("\n");
}
