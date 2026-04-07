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
  stablePrompt: string;
  dynamicPrompt: string;
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
  const onboardingPreferences = formatOnboardingPreferences(userSettings);
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

  const stableSections = [
    basePrompt,
    ...(persona.promptModifier
      ? ["## Persona", persona.promptModifier]
      : []),
    ...(customInstructions
      ? ["## Custom Instructions", customInstructions]
      : []),
    ...(onboardingPreferences
      ? ["## User Preferences", onboardingPreferences]
      : []),
    "## Available Tools",
    summarizeToolList(options.tools),
  ];

  const dynamicSections = [
    "## User Context",
    userContextLines.join("\n"),
    "## Your Memory",
    memorySection,
    "## Channel Context",
    channelContext,
  ];

  const stablePrompt = stableSections.join("\n\n");
  const dynamicPrompt = dynamicSections.join("\n\n");

  return {
    prompt: stablePrompt + "\n\n" + dynamicPrompt,
    stablePrompt,
    dynamicPrompt,
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

function formatOnboardingPreferences(settings: UserSettings): string | null {
  const workingStyle = settings.working_style;
  const assistantPreferences = settings.assistant_preferences;
  const lines: string[] = [];

  if (workingStyle?.writing_style) {
    lines.push(`- Writing style: ${formatWritingStyle(workingStyle.writing_style)}`);
  }

  if (workingStyle?.recommendation_style) {
    lines.push(`- Recommendation style: ${formatRecommendationStyle(workingStyle.recommendation_style)}`);
  }

  if (workingStyle?.planning_style) {
    lines.push(`- Planning style: ${formatPlanningStyle(workingStyle.planning_style)}`);
  }

  if (workingStyle?.work_rhythm) {
    lines.push(`- Work rhythm: ${formatWorkRhythm(workingStyle.work_rhythm)}`);
  }

  if (assistantPreferences?.primary_goals?.length) {
    lines.push(`- Primary goals: ${formatStringList(assistantPreferences.primary_goals)}`);
  }

  if (assistantPreferences?.calendar_habits?.length) {
    lines.push(`- Calendar habits: ${formatStringList(assistantPreferences.calendar_habits)}`);
  }

  if (assistantPreferences?.current_projects?.length) {
    lines.push(`- Current projects: ${formatStringList(assistantPreferences.current_projects)}`);
  }

  if (assistantPreferences?.voice) {
    lines.push(`- Voice: ${formatAssistantVoice(assistantPreferences.voice)}`);
  }

  if (!lines.length) {
    return null;
  }

  const guidance: string[] = [
    "Use these preferences to shape your responses and recommendations when they are relevant.",
    "Keep them lower priority than the persona and custom instructions sections above.",
  ];

  if (workingStyle?.writing_style) {
    guidance.push(`Write in a ${formatWritingStyle(workingStyle.writing_style).toLowerCase()} style.`);
  }

  if (workingStyle?.recommendation_style) {
    guidance.push(`When giving advice, default to a ${formatRecommendationStyle(workingStyle.recommendation_style).toLowerCase()} approach.`);
  }

  if (workingStyle?.planning_style) {
    guidance.push(`For planning requests, match the user's ${formatPlanningStyle(workingStyle.planning_style).toLowerCase()} planning style.`);
  }

  if (workingStyle?.work_rhythm) {
    guidance.push(`Respect the user's ${formatWorkRhythm(workingStyle.work_rhythm).toLowerCase()} work rhythm when suggesting timing or structure.`);
  }

  if (assistantPreferences?.calendar_habits?.length) {
    guidance.push(`When discussing schedule changes, account for calendar habits: ${formatStringList(assistantPreferences.calendar_habits)}.`);
  }

  if (assistantPreferences?.current_projects?.length) {
    guidance.push(`If relevant, anchor suggestions to active projects: ${formatStringList(assistantPreferences.current_projects)}.`);
  }

  if (assistantPreferences?.voice) {
    guidance.push(`Keep tone aligned with the ${formatAssistantVoice(assistantPreferences.voice).toLowerCase()} voice preference unless the persona or custom instructions override it.`);
  }

  return lines.concat("", "Behavioral guidance:", guidance.map((line) => `- ${line}`).join("\n")).join("\n");
}

function formatStringList(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function formatWritingStyle(value: NonNullable<NonNullable<UserSettings["working_style"]>["writing_style"]>): string {
  switch (value) {
    case "concise":
      return "Concise";
    case "balanced":
      return "Balanced";
    case "detailed":
      return "Detailed";
  }
}

function formatRecommendationStyle(
  value: NonNullable<NonNullable<UserSettings["working_style"]>["recommendation_style"]>,
): string {
  switch (value) {
    case "decision_first":
      return "Decision-first";
    case "context_first":
      return "Context-first";
  }
}

function formatPlanningStyle(value: NonNullable<NonNullable<UserSettings["working_style"]>["planning_style"]>): string {
  switch (value) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "both":
      return "Daily and weekly";
  }
}

function formatWorkRhythm(value: NonNullable<NonNullable<UserSettings["working_style"]>["work_rhythm"]>): string {
  switch (value) {
    case "morning_deep_work":
      return "Morning deep work";
    case "afternoon_deep_work":
      return "Afternoon deep work";
    case "flexible":
      return "Flexible";
  }
}

function formatAssistantVoice(value: NonNullable<NonNullable<UserSettings["assistant_preferences"]>["voice"]>): string {
  switch (value) {
    case "pragmatic":
      return "Pragmatic";
    case "friendly":
      return "Friendly";
    case "professional":
      return "Professional";
    case "academic":
      return "Academic";
  }
}
