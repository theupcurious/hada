"use client";

export const dynamic = "force-dynamic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusTab } from "@/components/settings/status-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AccountTab } from "@/components/settings/account-tab";
import { MemoryTab } from "@/components/settings/memory-tab";
import { TasksTab } from "@/components/settings/tasks-tab";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ComponentType } from "react";

type SettingsTabId = "integrations" | "account" | "memory" | "tasks" | "status";

type SettingsTabDescriptor = {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const SETTINGS_TABS_BY_LOCALE: Record<AppLocale, SettingsTabDescriptor[]> = {
  en: [
    { id: "integrations", label: "Integrations", description: "Google, Telegram, and linked tools", icon: IntegrationsIcon },
    { id: "account", label: "Account", description: "Profile, timezone, and defaults", icon: AccountIcon },
    { id: "memory", label: "Memory", description: "Saved preferences across chats", icon: MemoryIcon },
    { id: "tasks", label: "Tasks", description: "Scheduled tasks and automations", icon: TasksIcon },
    { id: "status", label: "Status", description: "Runtime health and provider checks", icon: StatusIcon },
  ],
  ko: [
    { id: "integrations", label: "연동", description: "Google, Telegram 및 연결 도구", icon: IntegrationsIcon },
    { id: "account", label: "계정", description: "프로필, 시간대, 기본값", icon: AccountIcon },
    { id: "memory", label: "메모리", description: "대화 전반의 저장된 선호도", icon: MemoryIcon },
    { id: "tasks", label: "작업", description: "예약 작업 및 자동화", icon: TasksIcon },
    { id: "status", label: "상태", description: "런타임 상태 및 제공자 점검", icon: StatusIcon },
  ],
  ja: [
    { id: "integrations", label: "連携", description: "Google、Telegram、接続済みツール", icon: IntegrationsIcon },
    { id: "account", label: "アカウント", description: "プロフィール、タイムゾーン、既定値", icon: AccountIcon },
    { id: "memory", label: "メモリ", description: "会話をまたいで保持される設定", icon: MemoryIcon },
    { id: "tasks", label: "タスク", description: "スケジュールされたタスクと自動化", icon: TasksIcon },
    { id: "status", label: "ステータス", description: "ランタイム状態とプロバイダー確認", icon: StatusIcon },
  ],
};

const SETTINGS_PAGE_COPY: Record<AppLocale, { title: string }> = {
  en: { title: "Settings" },
  ko: { title: "설정" },
  ja: { title: "設定" },
};

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const locale = useResolvedLocale();
  const copy = SETTINGS_PAGE_COPY[locale];
  const tabs = SETTINGS_TABS_BY_LOCALE[locale];
  const searchParams = useSearchParams();

  const initialTab = (() => {
    const tab = searchParams.get("tab");
    return tab && tabs.some((t) => t.id === tab) ? (tab as SettingsTabId) : "integrations";
  })();

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  return (
    <div className="h-full">
      <div className="flex h-full flex-col md:hidden">
        <div className="border-b border-border/60 bg-card/80 px-3 py-3 backdrop-blur-sm">
          <div className="-mx-3 overflow-x-auto px-3 pb-1">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => {
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
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">{copy.title}</p>
              <h1 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {tabs.find((tab) => tab.id === activeTab)?.description}
              </p>
            </div>
            {activeTab === "integrations" ? <IntegrationsTab /> : null}
            {activeTab === "account" ? <AccountTab /> : null}
            {activeTab === "memory" ? <MemoryTab /> : null}
            {activeTab === "tasks" ? <TasksTab /> : null}
            {activeTab === "status" ? <StatusTab /> : null}
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
            {tabs.map((tab) => {
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
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsTab />
            </TabsContent>
            <TabsContent value="account" className="mt-0">
              <AccountTab />
            </TabsContent>
            <TabsContent value="memory" className="mt-0">
              <MemoryTab />
            </TabsContent>
            <TabsContent value="tasks" className="mt-0">
              <TasksTab />
            </TabsContent>
            <TabsContent value="status" className="mt-0">
              <StatusTab />
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

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
