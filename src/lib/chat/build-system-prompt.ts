import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool } from "@/lib/chat/agent-loop";
import { summarizeToolList } from "@/lib/chat/tools";
import { getPersonaById } from "@/lib/chat/personas";
import type { MessageSource, UserSettings } from "@/lib/types/database";

const MEMORY_TOKEN_BUDGET = 2000;
const APPROX_CHARS_PER_TOKEN = 4;

let cachedBasePrompt: string | null = null;

export interface BuildSystemPromptResult {
  prompt: string;
  userSettings: UserSettings;
  userEmail: string | null;
  connectedIntegrations: string[];
}

export async function buildSystemPrompt(options: {
  supabase: SupabaseClient;
  userId: string;
  source: MessageSource;
  tools: AgentTool[];
  connectedIntegrations?: string[];
}): Promise<BuildSystemPromptResult> {
  const basePrompt = await getBasePrompt();

  const [userResult, integrationResult, memoryResult] = await Promise.all([
    options.supabase
      .from("users")
      .select("name, email, tier, settings")
      .eq("id", options.userId)
      .single(),
    options.connectedIntegrations
      ? Promise.resolve(null)
      : options.supabase
          .from("integrations")
          .select("provider")
          .eq("user_id", options.userId),
    options.supabase
      .from("user_memories")
      .select("topic, content, updated_at")
      .eq("user_id", options.userId)
      .order("updated_at", { ascending: false }),
  ]);

  const user = (userResult.data as unknown as {
    name?: string | null;
    email?: string | null;
    tier?: string | null;
    settings?: UserSettings;
  } | null);
  const userSettings = (user?.settings || {}) as UserSettings;
  const personaId = typeof userSettings.persona === "string" ? userSettings.persona : "default";
  const persona = getPersonaById(personaId);
  const customInstructions = typeof userSettings.custom_instructions === "string"
    ? userSettings.custom_instructions.trim()
    : "";
  const connectedIntegrations = options.connectedIntegrations ?? (
    (integrationResult as { data: Array<{ provider: string }> | null } | null)
      ?.data?.map((row) => row.provider) ?? []
  );
  const memorySection = formatMemories(
    (memoryResult.data as unknown as Array<{ topic: string; content: string; updated_at: string }> | null) || [],
  );
  const channelContext =
    options.source === "telegram"
      ? "User is messaging via Telegram. Keep formatting Telegram-safe and concise."
      : options.source === "scheduled"
      ? "This is a scheduled/system-initiated run. Be proactive and direct."
      : "User is messaging via the web chat UI.";

  const userTimezone = typeof userSettings.timezone === "string" ? userSettings.timezone : "UTC";
  const now = new Date();
  const localDatetime = new Intl.DateTimeFormat("en-US", {
    timeZone: userTimezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);
  const userLocation = userTimezone.includes("/")
    ? userTimezone.split("/").pop()!.replace(/_/g, " ")
    : userTimezone;

  const userContextLines = [
    `- Name: ${user?.name || "Unknown"}`,
    `- Email: ${user?.email || "Unknown"}`,
    `- Tier: ${user?.tier || "free"}`,
    `- Integrations: ${connectedIntegrations.length ? connectedIntegrations.join(", ") : "none"}`,
    `- Timezone: ${userTimezone}`,
    `- Location: ${userLocation}`,
    `- Current date/time: ${localDatetime}`,
  ];

  const sections = [
    basePrompt,
    "## User Context",
    userContextLines.join("\n"),
    ...(persona.promptModifier
      ? ["## Persona", persona.promptModifier]
      : []),
    ...(customInstructions
      ? ["## Custom Instructions", customInstructions]
      : []),
    "## Your Memory",
    memorySection,
    "## Available Tools",
    summarizeToolList(options.tools),
    "## Channel Context",
    channelContext,
  ];

  return {
    prompt: sections.join("\n\n"),
    userSettings,
    userEmail: user?.email || null,
    connectedIntegrations,
  };
}

async function getBasePrompt(): Promise<string> {
  if (cachedBasePrompt) {
    return cachedBasePrompt;
  }

  const promptPath = path.join(process.cwd(), "src/lib/chat/prompts/system.md");
  cachedBasePrompt = await readFile(promptPath, "utf-8");
  return cachedBasePrompt;
}

function formatMemories(
  memories: Array<{ topic: string; content: string; updated_at: string }>,
): string {
  if (!memories.length) {
    return "No stored memories yet.";
  }

  const maxChars = MEMORY_TOKEN_BUDGET * APPROX_CHARS_PER_TOKEN;
  const selected: string[] = [];
  let totalChars = 0;

  for (const memory of memories) {
    const line = `- ${memory.topic}: ${memory.content}`;
    if (totalChars + line.length > maxChars) {
      continue;
    }
    selected.push(line);
    totalChars += line.length;
  }

  return selected.length ? selected.join("\n") : "No memory entries fit token budget.";
}
