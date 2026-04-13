import type { AgentTool } from "@/lib/chat/agent-loop";
import {
  createGoogleCalendarTools,
  listCalendarEventsManifest,
  createCalendarEventManifest,
  updateCalendarEventManifest,
  deleteCalendarEventManifest,
} from "@/lib/chat/tools/google-calendar";
import { createDelegateTaskTool, delegateTaskManifest } from "@/lib/chat/tools/delegate-task";
import { createPlanTaskTool, planTaskManifest } from "@/lib/chat/tools/plan-task";
import { createRecallMemoryTool, recallMemoryManifest } from "@/lib/chat/tools/recall-memory";
import { createRenderCardTool, renderCardManifest } from "@/lib/chat/tools/render-card";
import { createSaveMemoryTool, saveMemoryManifest } from "@/lib/chat/tools/save-memory";
import { createScheduleTaskTool, scheduleTaskManifest } from "@/lib/chat/tools/schedule-task";
import type { ToolContext } from "@/lib/chat/tools/types";
import { createWebFetchTool, webFetchManifest } from "@/lib/chat/tools/web-fetch";
import { createWebSearchTool, webSearchManifest } from "@/lib/chat/tools/web-search";
import { createListDocumentsTool, listDocumentsManifest } from "@/lib/chat/tools/list-documents";
import { createReadDocumentTool, readDocumentManifest } from "@/lib/chat/tools/read-document";
import { createCreateDocumentTool, createDocumentManifest } from "@/lib/chat/tools/create-document";
import { createUpdateDocumentTool, updateDocumentManifest } from "@/lib/chat/tools/update-document";
import { createMcpCallTool, mcpCallManifest } from "@/lib/chat/tools/mcp-call";
import { createSearchDocumentsTool, searchDocumentsManifest } from "@/lib/chat/tools/search-documents";
import { createDeleteDocumentTool, deleteDocumentManifest } from "@/lib/chat/tools/delete-document";
import { registry } from "@/lib/chat/tools/tool-registry";

export interface CreateToolsOptions {
  connectedIntegrations?: string[];
}

// Register all core tools
registry.register({ manifest: saveMemoryManifest, create: createSaveMemoryTool });
registry.register({ manifest: recallMemoryManifest, create: createRecallMemoryTool });
registry.register({ manifest: scheduleTaskManifest, create: createScheduleTaskTool });
registry.register({ manifest: webSearchManifest, create: createWebSearchTool });
registry.register({ manifest: webFetchManifest, create: createWebFetchTool });
registry.register({ manifest: planTaskManifest, create: createPlanTaskTool });
registry.register({ manifest: delegateTaskManifest, create: createDelegateTaskTool });
registry.register({ manifest: renderCardManifest, create: createRenderCardTool });
registry.register({ manifest: listDocumentsManifest, create: createListDocumentsTool });
registry.register({ manifest: readDocumentManifest, create: createReadDocumentTool });
registry.register({ manifest: createDocumentManifest, create: createCreateDocumentTool });
registry.register({ manifest: updateDocumentManifest, create: createUpdateDocumentTool });
registry.register({ manifest: mcpCallManifest, create: createMcpCallTool });
registry.register({ manifest: searchDocumentsManifest, create: createSearchDocumentsTool });
registry.register({ manifest: deleteDocumentManifest, create: createDeleteDocumentTool });

// Register Google Calendar tools
registry.register({
  manifest: listCalendarEventsManifest,
  create: (ctx) => createGoogleCalendarTools(ctx).find((t) => t.name === listCalendarEventsManifest.name)!,
});
registry.register({
  manifest: createCalendarEventManifest,
  create: (ctx) => createGoogleCalendarTools(ctx).find((t) => t.name === createCalendarEventManifest.name)!,
});
registry.register({
  manifest: updateCalendarEventManifest,
  create: (ctx) => createGoogleCalendarTools(ctx).find((t) => t.name === updateCalendarEventManifest.name)!,
});
registry.register({
  manifest: deleteCalendarEventManifest,
  create: (ctx) => createGoogleCalendarTools(ctx).find((t) => t.name === deleteCalendarEventManifest.name)!,
});

export function createTools(
  context: ToolContext,
  options: CreateToolsOptions = {},
): AgentTool[] {
  const integrations = options.connectedIntegrations || [];
  return registry.getAvailable(context, integrations);
}

export function summarizeToolList(tools: AgentTool[]): string {
  if (!tools.length) {
    return "No tools available.";
  }

  return tools
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join("\n");
}
