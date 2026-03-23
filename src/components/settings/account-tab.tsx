"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Email</span>
            <span>{profile?.email || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Name</span>
            <span>{profile?.name || "Not set"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Member since</span>
            <span>{profile?.created_at ? formatDate(profile.created_at) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{saveMessage || ""}</span>
            <Button size="sm" onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save"}
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
