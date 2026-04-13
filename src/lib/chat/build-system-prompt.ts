import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool } from "@/lib/chat/agent-loop";
import { summarizeToolList } from "@/lib/chat/tools";
import { getPersonaById } from "@/lib/chat/personas";
import { normalizeLocale, resolveTurnLocale, type AppLocale } from "@/lib/i18n";
import type { MessageSource, UserSettings } from "@/lib/types/database";

const MEMORY_TOKEN_BUDGET = 2000;
const APPROX_CHARS_PER_TOKEN = 4;

let cachedBasePrompt: string | null = null;
let cachedWikiSchema: string | null = null;

export interface BuildSystemPromptResult {
  prompt: string;
  stablePrompt: string;
  dynamicPrompt: string;
  userSettings: UserSettings;
  userEmail: string | null;
  connectedIntegrations: string[];
  responseLocale: AppLocale;
  responseLocaleSource: "settings" | "message";
}

export async function buildSystemPrompt(options: {
  supabase: SupabaseClient;
  userId: string;
  source: MessageSource;
  tools: AgentTool[];
  connectedIntegrations?: string[];
  userMessage?: string;
  activeSegment?: { title: string | null; topic_key: string | null; message_count?: number | null; last_active_at?: string | null } | null;
}): Promise<BuildSystemPromptResult> {
  const basePrompt = await getBasePrompt();

  const [userResult, integrationResult, memoryResult, wikiCountResult] = await Promise.all([
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
      .select("topic, content, updated_at, kind, pinned")
      .eq("user_id", options.userId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false }),
    options.supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", options.userId)
      .eq("folder", "wiki"),
  ]);

  const hasWiki = (wikiCountResult?.count ?? 0) > 0;

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
  const preferredLocale = normalizeLocale(userSettings.locale);
  const resolvedResponseLocale = resolveTurnLocale(options.userMessage ?? "", preferredLocale);
  const languageGuidance = buildLanguageGuidance(preferredLocale, resolvedResponseLocale);
  const connectedIntegrations = options.connectedIntegrations ?? (
    (integrationResult as { data: Array<{ provider: string }> | null } | null)
      ?.data?.map((row) => row.provider) ?? []
  );
  const memorySection = formatMemories(
    (memoryResult.data as unknown as Array<{ topic: string; content: string; updated_at: string; kind?: string; pinned?: boolean }> | null) || [],
  );
  const channelContext =
    options.source === "telegram"
      ? "User is messaging via Telegram. Keep formatting Telegram-safe and concise."
      : options.source === "scheduled"
      ? "This is a scheduled/system-initiated run. Be proactive and direct."
      : "User is messaging via the web chat UI.";

  const userTimezone = typeof userSettings.timezone === "string" ? userSettings.timezone : "UTC";
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
  ];

  const wikiSchema = hasWiki ? await getWikiSchema() : null;

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
    "## Response Language",
    languageGuidance,
    "## Internal Topic Segments",
    buildSegmentGuidance(options.activeSegment ?? null),
    ...(wikiSchema ? [wikiSchema] : []),
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
    responseLocale: resolvedResponseLocale.locale,
    responseLocaleSource: resolvedResponseLocale.source,
  };
}

async function getWikiSchema(): Promise<string> {
  if (cachedWikiSchema) {
    return cachedWikiSchema;
  }

  const schemaPath = path.join(process.cwd(), "src/lib/chat/prompts/wiki-schema.md");
  cachedWikiSchema = await readFile(schemaPath, "utf-8");
  return cachedWikiSchema;
}

async function getBasePrompt(): Promise<string> {
  if (cachedBasePrompt) {
    return cachedBasePrompt;
  }

  const promptPath = path.join(process.cwd(), "src/lib/chat/prompts/system.md");
  cachedBasePrompt = await readFile(promptPath, "utf-8");
  return cachedBasePrompt;
}

function buildSegmentGuidance(
  activeSegment: { title: string | null; topic_key: string | null; message_count?: number | null; last_active_at?: string | null } | null,
): string {
  const lines: string[] = [
    "Manage internal topic segments silently.",
    "At the end of EVERY response, include exactly one hidden metadata line in one of these formats:",
    "  <!-- segment:continue -->",
    "  <!-- segment:new:topic-key:Short Title -->",
    "  <!-- segment:revive:topic-key -->",
    "",
    "SEGMENTATION RULES — be generous, not conservative:",
    "- Emit segment:new whenever the subject matter shifts, even partially.",
    "- Do NOT wait for a complete topic break. A gradual drift counts.",
    "- Examples that warrant segment:new:",
    "    • User was discussing a project, now asks a general question unrelated to it",
    "    • User switches from a technical topic to a personal/life topic",
    "    • User introduces a new person, place, product, or concept not tied to the current thread",
    "    • The user's intent or goal visibly changes (e.g. from planning → execution → reflection)",
    "- Examples that warrant segment:continue:",
    "    • Follow-up questions on the same subject",
    "    • Refinements or clarifications of the current task",
    "    • Asking for more detail or a different format for the same content",
    "- Use segment:revive if the user returns to a topic from earlier in the conversation.",
    "- topic-key must be a short kebab-case label (e.g. travel-planning, recipe-ideas, work-email).",
    "- Short Title is 2–5 words in title case.",
    "- This hidden line is stripped before the response reaches the user.",
  ];

  if (activeSegment) {
    const name = activeSegment.title ?? activeSegment.topic_key ?? "general";
    const count = typeof activeSegment.message_count === "number" ? activeSegment.message_count : null;
    const ageLabel = activeSegment.last_active_at ? formatSegmentAge(activeSegment.last_active_at) : null;

    const contextParts: string[] = [`Current segment: "${name}"`];
    if (count !== null) contextParts.push(`${count} messages so far`);
    if (ageLabel) contextParts.push(`last active ${ageLabel}`);
    lines.push("");
    lines.push(contextParts.join(", ") + ".");
    if (count !== null && count >= 6) {
      lines.push(`This segment already has ${count} messages — be especially willing to start a new segment if the topic has shifted.`);
    }
  } else {
    lines.push("");
    lines.push("No active segment yet. A new one will be created from your signal.");
    lines.push("Prefer segment:new with a descriptive topic-key for the first substantive message.");
  }

  return lines.join("\n");
}

function formatSegmentAge(lastActiveAt: string): string {
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 2) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}



function formatMemories(
  memories: Array<{ topic: string; content: string; updated_at: string; kind?: string; pinned?: boolean }>,
): string {
  if (!memories.length) {
    return "No stored memories yet.";
  }

  const maxChars = MEMORY_TOKEN_BUDGET * APPROX_CHARS_PER_TOKEN;

  // Priority: pinned first, then profile, then preference
  // project and archive are excluded from global injection (retrieved contextually in Phase 3)
  const pinned = memories.filter(m => m.pinned);
  const profile = memories.filter(m => !m.pinned && (m.kind === 'profile' || !m.kind));
  const preference = memories.filter(m => !m.pinned && m.kind === 'preference');

  const ordered = [...pinned, ...profile, ...preference];
  const selected: string[] = [];
  let totalChars = 0;

  for (const memory of ordered) {
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

function buildLanguageGuidance(
  preferredLocale: AppLocale,
  resolvedLocale: { locale: AppLocale; source: "settings" | "message" },
): string {
  const preferredLanguageName = getLanguageName(preferredLocale);
  const activeLanguageName = getLanguageName(resolvedLocale.locale);

  return [
    `Default response language from user settings: ${preferredLanguageName}.`,
    resolvedLocale.source === "message"
      ? `Current turn override: reply in ${activeLanguageName} because the user's latest message is written in that language.`
      : `Current turn response language: ${activeLanguageName}.`,
    "Use this language for all user-visible output, including summaries, cards, and follow-up suggestions.",
    "If the user explicitly asks for another language in this message, follow that request.",
  ].join("\n");
}

function getLanguageName(locale: AppLocale): string {
  switch (locale) {
    case "ko":
      return "Korean";
    case "ja":
      return "Japanese";
    case "zh":
      return "Chinese";
    case "en":
    default:
      return "English";
  }
}
