import type { LLMProviderName } from "@/lib/types/database";

export interface SubAgentProfile {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  provider?: LLMProviderName;
  model?: string;
  maxIterations?: number;
  timeout?: number;
  idleTimeout?: number;
}

export const AGENT_PROFILES: Record<string, SubAgentProfile> = {
  researcher: {
    name: "researcher",
    displayName: "Research Agent",
    description: "Searches the web and synthesizes information.",
    systemPrompt:
      "You are a focused research assistant. Your job is to find accurate, relevant information using web search and fetch tools. Be thorough but concise. Return structured findings with sources.",
    allowedTools: ["web_search", "web_fetch"],
    maxIterations: 6,
    timeout: 210_000,
    idleTimeout: 150_000,
  },
  memory_manager: {
    name: "memory_manager",
    displayName: "Memory Agent",
    description: "Manages long-term memory: stores, retrieves, and organizes information.",
    systemPrompt:
      "You are a memory management assistant. Your job is to store and recall information accurately. When saving, choose clear topic names. When recalling, search broadly and summarize relevant findings.",
    allowedTools: ["save_memory", "recall_memory"],
    maxIterations: 3,
    timeout: 120_000,
    idleTimeout: 75_000,
  },
  scheduler: {
    name: "scheduler",
    displayName: "Scheduling Agent",
    description: "Manages calendar events and scheduled tasks.",
    systemPrompt:
      "You are a scheduling assistant. Help manage calendar events and set up reminders/tasks. Be precise with dates and times. Always confirm timezone.",
    allowedTools: [
      "google_calendar_list",
      "google_calendar_create",
      "google_calendar_update",
      "google_calendar_delete",
      "schedule_task",
    ],
    maxIterations: 4,
    timeout: 180_000,
    idleTimeout: 90_000,
  },
};

export function getSubAgentProfile(agent: string): SubAgentProfile | null {
  return AGENT_PROFILES[agent] || null;
}

export function buildSubAgentSystemPrompt(
  profile: SubAgentProfile,
  task: string,
  context?: string,
): string {
  const toolList = profile.allowedTools.map((tool) => `- ${tool}`).join("\n");

  return [
    profile.systemPrompt,
    "",
    `You are operating as ${profile.displayName}.`,
    `Task: ${task}`,
    context ? `Context: ${context}` : null,
    profile.maxIterations ? `Limit yourself to about ${profile.maxIterations} tool-driven steps.` : null,
    profile.timeout ? `Complete within roughly ${Math.ceil(profile.timeout / 1000)} seconds.` : null,
    "Use only these tools:",
    toolList,
    "Return the final answer directly and do not mention internal orchestration unless it helps the user.",
  ]
    .filter(Boolean)
    .join("\n");
}
