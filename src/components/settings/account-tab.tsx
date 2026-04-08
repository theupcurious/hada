"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { PERSONAS } from "@/lib/chat/personas";
import { APP_LOCALE_OPTIONS, normalizeLocale, setLocaleCookie, type AppLocale } from "@/lib/i18n";
import type {
  AssistantVoice,
  LLMProviderName,
  PlanningStyle,
  RecommendationStyle,
  UserSettings,
  WorkRhythm,
  WritingStyle,
} from "@/lib/types/database";
import type { OpenRouterModelOption } from "@/lib/openrouter/models";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  created_at: string;
  settings: UserSettings;
}

const PROVIDER_OPTIONS: Array<{ value: LLMProviderName; label: string }> = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "minimax", label: "MiniMax" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "kimi", label: "Kimi (Moonshot)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "groq", label: "Groq" },
  { value: "mimo", label: "Xiaomi MiMo" },
];

interface OpenRouterModelsApiResponse {
  models?: OpenRouterModelOption[];
  error?: string;
}

export function AccountTab() {
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [provider, setProvider] = useState<LLMProviderName>("openrouter");
  const [model, setModel] = useState("");
  const [openRouterQuery, setOpenRouterQuery] = useState("");
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelOption[]>([]);
  const [loadingOpenRouterModels, setLoadingOpenRouterModels] = useState(false);
  const [openRouterModelsError, setOpenRouterModelsError] = useState<string | null>(null);
  const [openRouterPickerOpen, setOpenRouterPickerOpen] = useState(false);
  const [fallbackModel, setFallbackModel] = useState("");
  const [fallbackQuery, setFallbackQuery] = useState("");
  const [fallbackPickerOpen, setFallbackPickerOpen] = useState(false);
  const [locale, setLocale] = useState<AppLocale>("en");
  const [timezone, setTimezone] = useState("");
  const [persona, setPersona] = useState<string>("default");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [writingStyle, setWritingStyle] = useState<WritingStyle | "">("");
  const [recommendationStyle, setRecommendationStyle] = useState<RecommendationStyle | "">("");
  const [planningStyle, setPlanningStyle] = useState<PlanningStyle | "">("");
  const [workRhythm, setWorkRhythm] = useState<WorkRhythm | "">("");
  const [primaryGoals, setPrimaryGoals] = useState("");
  const [calendarHabits, setCalendarHabits] = useState("");
  const [currentProjects, setCurrentProjects] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingRegionalPreferences, setSavingRegionalPreferences] = useState(false);
  const [regionalSaveMessage, setRegionalSaveMessage] = useState<string | null>(null);
  const [savingAssistantPreferences, setSavingAssistantPreferences] = useState(false);
  const [assistantSaveMessage, setAssistantSaveMessage] = useState<string | null>(null);
  const [resettingOnboarding, setResettingOnboarding] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [clearChatMessage, setClearChatMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const [{ data }, roleData] = await Promise.all([
        supabase
        .from("users")
        .select("id, email, name, tier, created_at, settings")
        .single(),
        fetch("/api/auth/me", { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok) {
              return { isAdmin: false };
            }
            return (await response.json()) as { isAdmin?: boolean };
          })
          .catch(() => ({ isAdmin: false })),
      ]);

      if (!data) {
        return;
      }

      setIsAdmin(Boolean(roleData.isAdmin));

      const loaded = {
        id: data.id,
        email: data.email || "",
        name: data.name || null,
        tier: data.tier || "free",
        created_at: data.created_at,
        settings: (data.settings || {}) as UserSettings,
      };

      setProfile(loaded);
      const loadedProvider = (loaded.settings.llm_provider as LLMProviderName) || "openrouter";
      const loadedModel = typeof loaded.settings.llm_model === "string" ? loaded.settings.llm_model : "";
      setProvider(loadedProvider);
      setModel(loadedModel);
      setOpenRouterQuery(loadedModel);
      const loadedFallback = typeof loaded.settings.llm_fallback_model === "string" ? loaded.settings.llm_fallback_model : "";
      setFallbackModel(loadedFallback);
      setFallbackQuery(loadedFallback);
      const loadedLocale = normalizeLocale(loaded.settings.locale);
      setLocale(loadedLocale);
      setLocaleCookie(loadedLocale);
      setTimezone(typeof loaded.settings.timezone === "string" ? loaded.settings.timezone : "");
      setPersona(
        typeof loaded.settings.persona === "string"
          ? loaded.settings.persona
          : mapAssistantVoiceToPersona(loaded.settings.assistant_preferences?.voice),
      );
      setCustomInstructions(typeof loaded.settings.custom_instructions === "string" ? loaded.settings.custom_instructions : "");
      setWritingStyle(loaded.settings.working_style?.writing_style || "");
      setRecommendationStyle(loaded.settings.working_style?.recommendation_style || "");
      setPlanningStyle(loaded.settings.working_style?.planning_style || "");
      setWorkRhythm(loaded.settings.working_style?.work_rhythm || "");
      setPrimaryGoals(formatListField(loaded.settings.assistant_preferences?.primary_goals));
      setCalendarHabits(formatListField(loaded.settings.assistant_preferences?.calendar_habits));
      setCurrentProjects(formatListField(loaded.settings.assistant_preferences?.current_projects));
    };

    void loadProfile();
  }, [supabase]);

  useEffect(() => {
    if (!isAdmin || provider !== "openrouter") {
      return;
    }

    let active = true;
    const loadOpenRouterModels = async () => {
      setLoadingOpenRouterModels(true);
      setOpenRouterModelsError(null);

      try {
        const response = await fetch("/api/openrouter/models", {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => ({}))) as OpenRouterModelsApiResponse;
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load OpenRouter models.");
        }

        if (!active) {
          return;
        }

        setOpenRouterModels(Array.isArray(payload.models) ? payload.models : []);
      } catch (error) {
        if (!active) {
          return;
        }

        setOpenRouterModels([]);
        setOpenRouterModelsError(error instanceof Error ? error.message : "Failed to load OpenRouter models.");
      } finally {
        if (active) {
          setLoadingOpenRouterModels(false);
        }
      }
    };

    void loadOpenRouterModels();

    return () => {
      active = false;
    };
  }, [isAdmin, provider]);

  function handleProviderChange(nextProvider: LLMProviderName) {
    setProvider(nextProvider);
    if (nextProvider === "openrouter") {
      setOpenRouterQuery(model);
      return;
    }

    setOpenRouterPickerOpen(false);
    setOpenRouterQuery("");
    setModel("");
    setFallbackPickerOpen(false);
    setFallbackQuery("");
    setFallbackModel("");
  }

  const normalizedFallbackQuery = fallbackQuery.trim().toLowerCase();
  const filteredFallbackModels = openRouterModels
    .filter((option) => {
      if (!normalizedFallbackQuery) return true;
      return `${option.id} ${option.name}`.toLowerCase().includes(normalizedFallbackQuery);
    })
    .slice(0, 60);

  const normalizedOpenRouterQuery = openRouterQuery.trim().toLowerCase();
  const filteredOpenRouterModels = openRouterModels
    .filter((option) => {
      if (!normalizedOpenRouterQuery) {
        return true;
      }

      const haystack = `${option.id} ${option.name}`.toLowerCase();
      return haystack.includes(normalizedOpenRouterQuery);
    })
    .slice(0, 60);

  const isSavingPreferences = savingRegionalPreferences || savingAssistantPreferences;

  async function persistSettings(nextSettings: UserSettings) {
    if (!profile) {
      return false;
    }

    const { error } = await supabase
      .from("users")
      .update({ settings: nextSettings })
      .eq("id", profile.id);

    if (error) {
      return false;
    }

    setProfile((current) => (current ? { ...current, settings: nextSettings } : current));
    return true;
  }

  async function saveRegionalPreferences() {
    if (!profile || isSavingPreferences) return;
    setSavingRegionalPreferences(true);
    setRegionalSaveMessage(null);

    const nextSettings: UserSettings = {
      ...(profile.settings || {}),
      locale,
      timezone: timezone.trim() || null,
    };

    if (isAdmin) {
      nextSettings.llm_provider = provider;
      nextSettings.llm_model = model.trim() || null;
      nextSettings.llm_fallback_model = fallbackModel.trim() || null;
    } else {
      delete nextSettings.llm_provider;
      delete nextSettings.llm_model;
      delete nextSettings.llm_fallback_model;
    }

    const saved = await persistSettings(nextSettings);
    if (!saved) {
      setRegionalSaveMessage("Failed to save providers, language, and timezone.");
      setSavingRegionalPreferences(false);
      return;
    }

    setLocaleCookie(locale);
    setRegionalSaveMessage("Saved providers, language, and timezone.");
    setSavingRegionalPreferences(false);
  }

  async function saveAssistantPreferences() {
    if (!profile || isSavingPreferences) return;
    setSavingAssistantPreferences(true);
    setAssistantSaveMessage(null);

    const nextSettings: UserSettings = {
      ...(profile.settings || {}),
      persona,
      custom_instructions: customInstructions.trim() || null,
    };

    const nextWorkingStyle = {
      writing_style: writingStyle || undefined,
      recommendation_style: recommendationStyle || undefined,
      planning_style: planningStyle || undefined,
      work_rhythm: workRhythm || undefined,
    };
    if (Object.values(nextWorkingStyle).some(Boolean)) {
      nextSettings.working_style = nextWorkingStyle;
    } else {
      delete nextSettings.working_style;
    }

    const nextAssistantPreferences = {
      ...(profile.settings.assistant_preferences || {}),
      primary_goals: splitListField(primaryGoals),
      calendar_habits: splitListField(calendarHabits),
      current_projects: splitListField(currentProjects),
      voice: mapPersonaToAssistantVoice(persona),
      setup_version: profile.settings.assistant_preferences?.setup_version || 1,
    };
    if (
      nextAssistantPreferences.primary_goals.length > 0 ||
      nextAssistantPreferences.calendar_habits.length > 0 ||
      nextAssistantPreferences.current_projects.length > 0 ||
      nextAssistantPreferences.voice
    ) {
      if (!nextAssistantPreferences.voice) {
        delete nextAssistantPreferences.voice;
      }
      nextSettings.assistant_preferences = nextAssistantPreferences;
    } else {
      delete nextSettings.assistant_preferences;
    }

    const saved = await persistSettings(nextSettings);
    if (!saved) {
      setAssistantSaveMessage("Failed to save working style and assistant preferences.");
      setSavingAssistantPreferences(false);
      return;
    }

    setAssistantSaveMessage("Saved working style and assistant preferences.");
    setSavingAssistantPreferences(false);
  }

  async function clearChat() {
    if (clearingChat) return;
    if (!window.confirm("Clear your current chat history? This removes the current conversation and its messages.")) {
      return;
    }

    setClearingChat(true);
    setClearChatMessage(null);

    try {
      const response = await fetch("/api/conversations", {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        cleared?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear chat.");
      }

      setClearChatMessage(
        data.cleared ? "Chat cleared. Your next message will start a new conversation." : "No chat history to clear.",
      );
    } catch (error) {
      setClearChatMessage(error instanceof Error ? error.message : "Failed to clear chat.");
    } finally {
      setClearingChat(false);
    }
  }

  async function resetOnboarding() {
    if (!profile || resettingOnboarding || isSavingPreferences) {
      return;
    }

    if (!window.confirm("Reset onboarding? This will clear your saved working style, welcome state, and show first-run setup again in chat.")) {
      return;
    }

    setResettingOnboarding(true);
    setAssistantSaveMessage(null);

    const nextSettings: UserSettings = {
      ...(profile.settings || {}),
      onboarding_completed: false,
      persona: "default",
    };
    delete nextSettings.working_style;
    delete nextSettings.assistant_preferences;
    delete nextSettings.welcome_state;

    const saved = await persistSettings(nextSettings);
    if (!saved) {
      setAssistantSaveMessage("Failed to reset onboarding.");
      setResettingOnboarding(false);
      return;
    }

    setPersona("default");
    setWritingStyle("");
    setRecommendationStyle("");
    setPlanningStyle("");
    setWorkRhythm("");
    setPrimaryGoals("");
    setCalendarHabits("");
    setCurrentProjects("");
    setAssistantSaveMessage("Onboarding reset. You will see setup again in chat.");
    setResettingOnboarding(false);
  }

  const tierConfig = {
    free: { label: "Free", color: "secondary" as const },
    paid: { label: "Paid", color: "default" as const },
    pro: { label: "Pro", color: "default" as const },
  };

  const tier = tierConfig[profile?.tier as keyof typeof tierConfig] || tierConfig.free;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Account</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isAdmin
            ? "Manage account details and model preferences."
            : "Manage account details and preferences."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Email</span>
            <span className="break-all">{profile?.email || "—"}</span>
          </div>
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Name</span>
            <span>{profile?.name || "Not set"}</span>
          </div>
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Member since</span>
            <span>{profile?.created_at ? formatDate(profile.created_at) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Subscription</CardTitle>
              <CardDescription>Your current plan.</CardDescription>
            </div>
            <Badge variant={tier.color}>{tier.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {profile?.tier === "free"
              ? "You're on the free plan."
              : "You have full paid plan access."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Providers, language & timezone</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Configure provider defaults, response language, and timezone."
              : "Configure your response language and timezone."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                  value={provider}
                  onChange={(event) => handleProviderChange(event.target.value as LLMProviderName)}
                >
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {provider === "openrouter" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model (OpenRouter)</label>
                  <div className="relative">
                    <Input
                      value={openRouterQuery}
                      onFocus={() => setOpenRouterPickerOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => setOpenRouterPickerOpen(false), 120);
                      }}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setOpenRouterQuery(nextValue);
                        setModel(nextValue.trim());
                        setOpenRouterPickerOpen(true);
                      }}
                      placeholder={loadingOpenRouterModels ? "Loading OpenRouter models..." : "Search OpenRouter models"}
                    />
                    {openRouterPickerOpen && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                        <button
                          type="button"
                          className={`w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                            model ? "text-zinc-700 dark:text-zinc-300" : "bg-zinc-100 dark:bg-zinc-800"
                          }`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setModel("");
                            setOpenRouterQuery("");
                            setOpenRouterPickerOpen(false);
                          }}
                        >
                          Use OpenRouter provider default model
                        </button>
                        {filteredOpenRouterModels.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`w-full rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                              model === option.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                            }`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setModel(option.id);
                              setOpenRouterQuery(option.id);
                              setOpenRouterPickerOpen(false);
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">{option.name}</span>
                              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                {option.priceSummary}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{option.id}</p>
                          </button>
                        ))}
                        {!loadingOpenRouterModels && filteredOpenRouterModels.length === 0 && (
                          <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">No models found.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {openRouterModelsError
                      ? `Could not load model pricing: ${openRouterModelsError}`
                      : "Search and pick an OpenRouter model. Leave blank to use the provider default."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="Enter model ID"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    For this provider, enter the model manually.
                  </p>
                </div>
              )}
            </>
          )}
          {isAdmin && provider === "openrouter" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Fallback model (OpenRouter)</label>
              <div className="relative">
                <Input
                  value={fallbackQuery}
                  onFocus={() => setFallbackPickerOpen(true)}
                  onBlur={() => { window.setTimeout(() => setFallbackPickerOpen(false), 120); }}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setFallbackQuery(nextValue);
                    setFallbackModel(nextValue.trim());
                    setFallbackPickerOpen(true);
                  }}
                  placeholder={loadingOpenRouterModels ? "Loading models..." : "Search fallback model"}
                />
                {fallbackPickerOpen && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                    <button
                      type="button"
                      className={`w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                        !fallbackModel ? "bg-zinc-100 dark:bg-zinc-800" : "text-zinc-700 dark:text-zinc-300"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setFallbackModel(""); setFallbackQuery(""); setFallbackPickerOpen(false); }}
                    >
                      No fallback model
                    </button>
                    {filteredFallbackModels.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`w-full rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                          fallbackModel === option.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setFallbackModel(option.id); setFallbackQuery(option.id); setFallbackPickerOpen(false); }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{option.name}</span>
                          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{option.priceSummary}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{option.id}</p>
                      </button>
                    ))}
                    {!loadingOpenRouterModels && filteredFallbackModels.length === 0 && (
                      <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">No models found.</p>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Used automatically if the primary model fails. Leave blank for no fallback.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
              value={locale}
              onChange={(event) => setLocale(event.target.value as AppLocale)}
            >
              {APP_LOCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Controls chat UI copy and default assistant response language.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Timezone (optional)</label>
            <Input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="e.g. America/Los_Angeles"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-zinc-500">{regionalSaveMessage || ""}</span>
            <Button size="sm" onClick={saveRegionalPreferences} disabled={isSavingPreferences}>
              {savingRegionalPreferences ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Working style & assistant</CardTitle>
          <CardDescription>
            Configure planning defaults, saved context, and how Hada communicates with you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/40">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Working style</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  These settings shape onboarding, summaries, and planning defaults.
                </p>
              </div>
              <p className="text-xs text-zinc-400">Optional</p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Writing style</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                  value={writingStyle}
                  onChange={(event) => setWritingStyle(event.target.value as WritingStyle | "")}
                >
                  <option value="">Use default</option>
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Recommendation style</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                  value={recommendationStyle}
                  onChange={(event) => setRecommendationStyle(event.target.value as RecommendationStyle | "")}
                >
                  <option value="">Use default</option>
                  <option value="decision_first">Decision first</option>
                  <option value="context_first">Context first</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Planning style</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                  value={planningStyle}
                  onChange={(event) => setPlanningStyle(event.target.value as PlanningStyle | "")}
                >
                  <option value="">Use default</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Work rhythm</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
                  value={workRhythm}
                  onChange={(event) => setWorkRhythm(event.target.value as WorkRhythm | "")}
                >
                  <option value="">Use default</option>
                  <option value="morning_deep_work">Morning deep work</option>
                  <option value="afternoon_deep_work">Afternoon deep work</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Primary goals</label>
                <textarea
                  value={primaryGoals}
                  onChange={(event) => setPrimaryGoals(event.target.value)}
                  rows={2}
                  placeholder="Protect focus time, turn ideas into docs, stay on top of projects"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Calendar habits</label>
                <textarea
                  value={calendarHabits}
                  onChange={(event) => setCalendarHabits(event.target.value)}
                  rows={2}
                  placeholder="Avoid mornings, batch meetings, protect 2h focus blocks"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Current projects</label>
                <textarea
                  value={currentProjects}
                  onChange={(event) => setCurrentProjects(event.target.value)}
                  rows={2}
                  placeholder="Agent 2026, Parenting with AI"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-400"
                />
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Separate items with commas or new lines.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Persona</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Choose how Hada communicates with you. This is the same tone control used in first-run onboarding.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersona(p.id)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    persona === p.id
                      ? "border-teal-500 bg-teal-50 shadow-sm dark:border-teal-400 dark:bg-teal-950/30"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    persona === p.id
                      ? "text-teal-700 dark:text-teal-300"
                      : "text-zinc-900 dark:text-zinc-100"
                  }`}>
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-instructions"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Custom instructions (optional)
            </label>
            <p className="mt-0.5 text-xs text-zinc-400">
              Tell Hada anything specific about how you want it to behave.
            </p>
            <textarea
              id="custom-instructions"
              value={customInstructions}
              onChange={(event) => setCustomInstructions(event.target.value)}
              placeholder="e.g., Always respond in Korean when I write in Korean. Prefer metric units."
              rows={3}
              maxLength={1000}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-400"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">
              {customInstructions.length}/1000
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-zinc-200/80 bg-background/70 px-3 py-3 dark:border-zinc-800/70 dark:bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Reset onboarding</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Clear saved working-style and welcome preferences, then show first-run setup again in chat.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void resetOnboarding()}
              disabled={resettingOnboarding || isSavingPreferences}
              className="shrink-0"
            >
              {resettingOnboarding ? "Resetting..." : "Reset onboarding"}
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-zinc-500">{assistantSaveMessage || ""}</span>
            <Button size="sm" onClick={saveAssistantPreferences} disabled={isSavingPreferences}>
              {savingAssistantPreferences ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200/70 dark:border-red-900/40">
        <CardHeader>
          <CardTitle className="text-base">Chat History</CardTitle>
          <CardDescription>
            Reset your current conversation if you want to start fresh without prior context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This removes your current chat thread and its saved message history. A new conversation will be created automatically the next time you send a message.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-zinc-500">{clearChatMessage || ""}</span>
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => void clearChat()}
              disabled={clearingChat}
            >
              {clearingChat ? "Clearing..." : "Clear chat"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function splitListField(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatListField(values?: string[] | null): string {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }

  return values.join(", ");
}

function mapAssistantVoiceToPersona(voice?: AssistantVoice): string {
  switch (voice) {
    case "friendly":
      return "friendly";
    case "professional":
      return "professional";
    case "academic":
      return "academic";
    case "pragmatic":
      return "concise";
    default:
      return "default";
  }
}

function mapPersonaToAssistantVoice(persona: string): AssistantVoice | undefined {
  switch (persona) {
    case "concise":
      return "pragmatic";
    case "friendly":
      return "friendly";
    case "professional":
      return "professional";
    case "academic":
      return "academic";
    default:
      return undefined;
  }
}
