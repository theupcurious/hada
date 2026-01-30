"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface UserProfile {
  email: string;
  name: string | null;
  tier: string;
  created_at: string;
}

export function AccountTab() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfile({
          email: user.email || "",
          name: user.user_metadata?.name || null,
          tier: "free", // TODO: fetch from users table
          created_at: user.created_at,
        });
      }
    };
    loadProfile();
  }, [supabase]);

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
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your account settings and subscription.
        </p>
      </div>

      {/* Profile Card */}
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

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Subscription</CardTitle>
              <CardDescription>Your current plan and usage.</CardDescription>
            </div>
            <Badge variant={tier.color}>{tier.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {profile?.tier === "free" ? (
                <>You&apos;re on the free plan. Upgrade to unlock more features.</>
              ) : (
                <>Thank you for subscribing! You have full access to all features.</>
              )}
            </p>
          </div>
          {/* Placeholder for upgrade button */}
          {profile?.tier === "free" && (
            <p className="text-xs text-zinc-400">Billing coming soon.</p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="text-base text-red-600 dark:text-red-400">Danger Zone</CardTitle>
          <CardDescription>Irreversible account actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Account deletion will be available in a future update.
          </p>
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
