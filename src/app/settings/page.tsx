"use client";

export const dynamic = "force-dynamic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusTab } from "@/components/settings/status-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AccountTab } from "@/components/settings/account-tab";
import { MemoryTab } from "@/components/settings/memory-tab";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";

type SettingsTabId = "status" | "integrations" | "account" | "memory";

const SETTINGS_TABS: Array<{
  id: SettingsTabId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "status",
    label: "Status",
    description: "Runtime health and provider checks",
    icon: StatusIcon,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Google, Telegram, and linked tools",
    icon: IntegrationsIcon,
  },
  {
    id: "account",
    label: "Account",
    description: "Profile, timezone, and defaults",
    icon: AccountIcon,
  },
  {
    id: "memory",
    label: "Memory",
    description: "Saved preferences across chats",
    icon: MemoryIcon,
  },
];

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("status");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setIsLoading(false);
    };
    void checkAuth();
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex h-full flex-col md:hidden">
        <div className="border-b border-border/60 bg-card/80 px-3 py-3 backdrop-blur-sm">
          <div className="-mx-3 overflow-x-auto px-3 pb-1">
            <div className="flex min-w-max gap-2">
              {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-teal-500/60 bg-teal-500/10 text-zinc-950 shadow-sm shadow-teal-500/10 dark:text-zinc-50"
                        : "border-zinc-200/70 bg-white/70 text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-900/50 dark:text-zinc-300",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-3">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">Settings</p>
              <h1 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {SETTINGS_TABS.find((tab) => tab.id === activeTab)?.description}
              </p>
            </div>
            {activeTab === "status" ? <StatusTab /> : null}
            {activeTab === "integrations" ? <IntegrationsTab /> : null}
            {activeTab === "account" ? <AccountTab /> : null}
            {activeTab === "memory" ? <MemoryTab /> : null}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTabId)}
        className="hidden h-full w-full flex-col md:flex md:flex-row"
        orientation="vertical"
      >
        <div className="hidden w-56 shrink-0 flex-col border-r border-border/60 bg-card/50 p-4 backdrop-blur-sm md:flex">
          <TabsList className="flex h-auto flex-col gap-1 bg-transparent">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="w-full justify-start rounded-lg px-3 py-2 text-left transition-all duration-200 data-[state=active]:border-l-2 data-[state=active]:border-l-teal-500 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:px-4 md:p-6">
          <div className="max-w-3xl">
            <TabsContent value="status" className="mt-0">
              <StatusTab />
            </TabsContent>
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsTab />
            </TabsContent>
            <TabsContent value="account" className="mt-0">
              <AccountTab />
            </TabsContent>
            <TabsContent value="memory" className="mt-0">
              <MemoryTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function StatusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IntegrationsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function MemoryIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5c-4.5 0-8 2-8 4.5S7.5 14 12 14s8-2 8-4.5S16.5 5 12 5Z" />
      <path d="M4 9.5V15c0 2.5 3.5 4.5 8 4.5s8-2 8-4.5V9.5" />
      <path d="M8 12.5v3" />
      <path d="M12 13.5V17" />
      <path d="M16 12.5v3" />
    </svg>
  );
}
