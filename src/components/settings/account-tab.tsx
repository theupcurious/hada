"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { PERSONAS } from "@/lib/chat/personas";
import type { LLMProviderName, UserSettings } from "@/lib/types/database";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  created_at: string;
  settings: UserSettings;
}

const PROVIDER_OPTIONS: Array<{ value: LLMProviderName; label: string }> = [
  { value: "minimax", label: "MiniMax" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "kimi", label: "Kimi (Moonshot)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "groq", label: "Groq" },
];

export function AccountTab() {
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [provider, setProvider] = useState<LLMProviderName>("minimax");
  const [model, setModel] = useState("");
  const [timezone, setTimezone] = useState("");
  const [persona, setPersona] = useState<string>("default");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [clearingChat, setClearingChat] = useState(false);
  const [clearChatMessage, setClearChatMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      try {
        const roleResponse = await fetch("/api/auth/me", { cache: "no-store" });
        if (roleResponse.ok) {
          const roleData = (await roleResponse.json()) as { isAdmin?: boolean };
          setIsAdmin(Boolean(roleData.isAdmin));
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }

      const { data } = await supabase
        .from("users")
        .select("id, email, name, tier, created_at, settings")
        .eq("id", user.id)
        .single();

      const loaded = {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || data?.name || null,
        tier: data?.tier || "free",
        created_at: user.created_at,
        settings: (data?.settings || {}) as UserSettings,
      };

      setProfile(loaded);
      setProvider((loaded.settings.llm_provider as LLMProviderName) || "minimax");
      setModel(typeof loaded.settings.llm_model === "string" ? loaded.settings.llm_model : "");
      setTimezone(typeof loaded.settings.timezone === "string" ? loaded.settings.timezone : "");
      setPersona(typeof loaded.settings.persona === "string" ? loaded.settings.persona : "default");
      setCustomInstructions(typeof loaded.settings.custom_instructions === "string" ? loaded.settings.custom_instructions : "");
    };

    void loadProfile();
  }, [supabase]);

  async function saveSettings() {
    if (!profile) return;
    setSaving(true);
    setSaveMessage(null);

    const nextSettings: UserSettings = {
      ...(profile.settings || {}),
      timezone: timezone.trim() || null,
      persona,
      custom_instructions: customInstructions.trim() || null,
    };
    if (isAdmin) {
      nextSettings.llm_provider = provider;
      nextSettings.llm_model = model.trim() || null;
    } else {
      delete nextSettings.llm_provider;
      delete nextSettings.llm_model;
    }

    const { error } = await supabase
      .from("users")
      .update({ settings: nextSettings })
      .eq("id", profile.id);

    if (error) {
      setSaveMessage("Failed to save settings.");
      setSaving(false);
      return;
    }

    setProfile({ ...profile, settings: nextSettings });
    setSaveMessage("Settings saved.");
    setSaving(false);
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
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Configure timezone and default provider/model used by your agent loop."
              : "Configure your timezone preference."}
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
                  onChange={(event) => setProvider(event.target.value as LLMProviderName)}
                >
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model (optional override)</label>
                <Input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="Leave blank for provider default"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Timezone (optional)</label>
            <Input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="e.g. America/Los_Angeles"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-zinc-500">{saveMessage || ""}</span>
            <Button size="sm" onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Persona Section */}
      <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Persona
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Choose how Hada communicates with you.
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

        <div className="mt-4">
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
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g., Always respond in Korean when I write in Korean. Prefer metric units."
            rows={3}
            maxLength={1000}
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-400"
          />
          <p className="mt-1 text-right text-xs text-zinc-400">
            {customInstructions.length}/1000
          </p>
        </div>
      </div>

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
