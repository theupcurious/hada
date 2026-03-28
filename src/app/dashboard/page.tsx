"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  EllipsisVertical,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquareText,
  PencilLine,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AgentRun, ScheduledTask, UserMemory } from "@/lib/types/database";

type DashboardActivityResponse = {
  runs?: AgentRun[];
  total?: number;
  limit?: number;
  offset?: number;
};

type DashboardAnalyticsResponse = {
  totalRuns?: number;
  avgDurationMs?: number;
  successRate?: number;
  toolUsage?: Array<{
    name?: string;
    count?: number;
    avgDurationMs?: number;
    errorRate?: number;
    lastUsed?: string;
  }>;
  dailyActivity?: Array<{ date?: string; dateLabel?: string; runs?: number }>;
  mostUsedTool?: string;
};

type DashboardMemoryResponse = {
  memories?: UserMemory[];
} | UserMemory[];

type DashboardTaskResponse = {
  tasks?: DashboardTask[];
} | DashboardTask[];

type DashboardTask = ScheduledTask & {
  next_run_at?: string | null;
};

type LoadState<T> = {
  available: boolean;
  loading: boolean;
  error: string | null;
  data: T;
};

type MemoryEditorState = {
  id: string;
  topic: string;
  content: string;
};

type DashboardTabId = "activity" | "analytics" | "memories" | "tasks";

const INITIAL_ACTIVITY_LIMIT = 25;

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("activity");
  const [user, setUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [activity, setActivity] = useState<LoadState<DashboardActivityResponse>>({
    available: true,
    loading: true,
    error: null,
    data: { runs: [], total: 0, limit: INITIAL_ACTIVITY_LIMIT, offset: 0 },
  });
  const [analytics, setAnalytics] = useState<LoadState<DashboardAnalyticsResponse | null>>({
    available: true,
    loading: true,
    error: null,
    data: null,
  });
  const [memories, setMemories] = useState<LoadState<UserMemory[]>>({
    available: true,
    loading: true,
    error: null,
    data: [],
  });
  const [tasks, setTasks] = useState<LoadState<DashboardTask[]>>({
    available: true,
    loading: true,
    error: null,
    data: [],
  });
  const [refreshEnabled, setRefreshEnabled] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [taskQuery, setTaskQuery] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryEditorState | null>(null);
  const [newMemoryOpen, setNewMemoryOpen] = useState(false);
  const [newMemoryDraft, setNewMemoryDraft] = useState({ topic: "", content: "" });
  const router = useRouter();
  const supabase = createClient();
  const deferredMemoryQuery = useDeferredValue(memoryQuery.trim().toLowerCase());
  const deferredTaskQuery = useDeferredValue(taskQuery.trim().toLowerCase());

  const loadActivity = useCallback(
    async (initial = false) => {
      setActivity((prev) => ({ ...prev, loading: initial ? true : prev.loading, error: null }));

      const result = await fetchDashboardJson<DashboardActivityResponse>(
        `/api/dashboard/activity?limit=${INITIAL_ACTIVITY_LIMIT}&offset=0`,
      );

      setActivity((prev) => ({
        available: result.available,
        loading: false,
        error: result.error,
        data: normalizeActivity(result.data) ?? prev.data,
      }));
    },
    [],
  );

  const loadAnalytics = useCallback(async () => {
    setAnalytics((prev) => ({ ...prev, loading: true, error: null }));
    const result = await fetchDashboardJson<DashboardAnalyticsResponse>("/api/dashboard/analytics?days=7");
    setAnalytics(() => ({
      available: result.available,
      loading: false,
      error: result.error,
      data: normalizeAnalytics(result.data),
    }));
  }, []);

  const loadMemories = useCallback(async () => {
    setMemories((prev) => ({ ...prev, loading: true, error: null }));
    const result = await fetchDashboardJson<DashboardMemoryResponse>("/api/dashboard/memories");
    setMemories({
      available: result.available,
      loading: false,
      error: result.error,
      data: normalizeMemoryList(result.data),
    });
  }, []);

  const loadTasks = useCallback(async () => {
    setTasks((prev) => ({ ...prev, loading: true, error: null }));
    const result = await fetchDashboardJson<DashboardTaskResponse>("/api/dashboard/tasks");
    setTasks({
      available: result.available,
      loading: false,
      error: result.error,
      data: normalizeTaskList(result.data),
    });
  }, []);

  const loadMoreActivity = useCallback(async () => {
    const currentOffset = activity.data.offset ?? 0;
    const nextOffset = currentOffset + (activity.data.limit ?? INITIAL_ACTIVITY_LIMIT);
    const result = await fetchDashboardJson<DashboardActivityResponse>(
      `/api/dashboard/activity?limit=${activity.data.limit ?? INITIAL_ACTIVITY_LIMIT}&offset=${nextOffset}`,
    );

    const nextPayload = normalizeActivity(result.data);
    if (!nextPayload) return;

    setActivity((prev) => ({
      available: result.available,
      loading: false,
      error: result.error,
      data: {
        runs: [...(prev.data.runs || []), ...(nextPayload.runs || [])],
        total: nextPayload.total ?? prev.data.total,
        limit: nextPayload.limit ?? prev.data.limit,
        offset: nextPayload.offset ?? nextOffset,
      },
    }));
  }, [activity.data.limit, activity.data.offset]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;

      if (error || !data.user) {
        router.push("/auth/login");
        return;
      }

      setUser({
        name: data.user.user_metadata?.name ?? data.user.email ?? null,
        email: data.user.email ?? null,
      });

      await Promise.all([loadActivity(), loadAnalytics(), loadMemories(), loadTasks()]);
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [router, supabase, loadActivity, loadAnalytics, loadMemories, loadTasks]);

  useEffect(() => {
    if (!refreshEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadActivity(true);
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [refreshEnabled, loadActivity]);

  const activityRuns = useMemo(() => activity.data.runs || [], [activity.data.runs]);
  const totalRuns = activity.data.total ?? activityRuns.length;
  const dashboardSummary = useMemo(() => buildSummary(activityRuns, analytics.data), [activityRuns, analytics.data]);
  const dailyActivity = analytics.data?.dailyActivity?.length
    ? analytics.data.dailyActivity
    : dashboardSummary.dailyActivity;
  const maxDailyActivityRuns = useMemo(
    () => Math.max(1, ...dailyActivity.map((day) => day.runs ?? 0)),
    [dailyActivity],
  );
  const filteredMemories = useMemo(
    () =>
      memories.data.filter((memory) => {
        if (!deferredMemoryQuery) return true;
        return (
          memory.topic.toLowerCase().includes(deferredMemoryQuery) ||
          memory.content.toLowerCase().includes(deferredMemoryQuery)
        );
      }),
    [deferredMemoryQuery, memories.data],
  );
  const filteredTasks = useMemo(
    () =>
      tasks.data.filter((task) => {
        if (!deferredTaskQuery) return true;
        const haystack = `${task.description} ${task.cron_expression || ""} ${task.run_at || ""}`.toLowerCase();
        return haystack.includes(deferredTaskQuery);
      }),
    [deferredTaskQuery, tasks.data],
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleMemorySave = async (memoryId: string) => {
    if (!memoryDraft) return;
    const response = await fetch(`/api/dashboard/memories/${memoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: memoryDraft.topic, content: memoryDraft.content }),
    });
    if (response.ok) {
      setEditingMemoryId(null);
      setMemoryDraft(null);
      void loadMemories();
    }
  };

  const handleMemoryDelete = async (memoryId: string) => {
    if (!window.confirm("Delete this memory?")) return;
    const response = await fetch(`/api/dashboard/memories/${memoryId}`, { method: "DELETE" });
    if (response.ok) {
      void loadMemories();
    }
  };

  const handleMemoryCreate = async () => {
    const response = await fetch("/api/dashboard/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMemoryDraft),
    });
    if (response.ok) {
      setNewMemoryOpen(false);
      setNewMemoryDraft({ topic: "", content: "" });
      void loadMemories();
    }
  };

  const handleTaskToggle = async (task: DashboardTask) => {
    const response = await fetch(`/api/dashboard/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !task.enabled }),
    });
    if (response.ok) void loadTasks();
  };

  const handleTaskDelete = async (taskId: string) => {
    if (!window.confirm("Delete this task?")) return;
    const response = await fetch(`/api/dashboard/tasks/${taskId}`, { method: "DELETE" });
    if (response.ok) void loadTasks();
  };

  const handleTaskRunNow = async (taskId: string) => {
    const response = await fetch(`/api/dashboard/tasks/${taskId}/run`, { method: "POST" });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    if (response.ok) {
      void loadTasks();
      if (payload?.message) {
        window.alert(payload.message);
      }
      return;
    }

    window.alert(payload?.message || `Run now failed with status ${response.status}.`);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
      <header className="mb-4 flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 px-3 py-3 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/70 sm:mb-6 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 text-white shadow-lg shadow-teal-500/20 sm:flex">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight sm:text-xl">Dashboard</h1>
              <Badge variant="outline" className="hidden rounded-full border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 sm:inline-flex">
                Control plane
              </Badge>
            </div>
            <p className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">
              Activity, analytics, memory, and task management in one place.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2">
          <Button asChild variant="ghost" size="icon" className="rounded-full sm:hidden">
            <Link href="/chat" aria-label="Back to chat">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-full sm:inline-flex">
            <Link href="/chat">
              <ArrowLeft className="h-4 w-4" />
              Back to chat
            </Link>
          </Button>
          <ThemeToggle />
          <Button variant="outline" size="icon" className="rounded-full sm:hidden" onClick={() => void loadActivity(true)} aria-label="Refresh dashboard">
            <RefreshCw className={cn("h-4 w-4", activity.loading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" className="hidden rounded-full sm:inline-flex" onClick={() => void loadActivity(true)}>
            <RefreshCw className={cn("h-4 w-4", activity.loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full sm:hidden" onClick={handleSignOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="hidden rounded-full sm:inline-flex" onClick={handleSignOut}>
            Sign out
          </Button>
          <Avatar className="hidden h-9 w-9 sm:flex">
            <AvatarFallback className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {initials(user?.name || user?.email || "U")}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <section className="mb-4 grid gap-3 sm:hidden">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Runs" value={formatNumber(totalRuns)} hint="Recorded" icon={<MessageSquareText className="h-4 w-4" />} />
          <MetricCard label="Success" value={`${dashboardSummary.successRate}%`} hint="Recent" icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>
      </section>

      <section className="hidden gap-4 sm:grid lg:grid-cols-[1.7fr_1fr]">
        <Card className="border-zinc-200/80 bg-white/85 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
          <CardHeader className="pb-3">
            <CardDescription className="uppercase tracking-[0.24em] text-zinc-400">
              Overview
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">
              Welcome{user?.name ? `, ${user.name}` : ""}.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Track every agent run, inspect tool usage, manage long-term memory, and keep scheduled work under control from a single surface.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                <Clock3 className="h-3.5 w-3.5" />
                {activity.available ? "Activity live" : "Activity unavailable"}
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                <TrendingUp className="h-3.5 w-3.5" />
                {dashboardSummary.successRate}% success
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                <ShieldAlert className="h-3.5 w-3.5" />
                {analytics.available ? "Analytics connected" : "Analytics pending"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <MetricCard label="Total runs" value={formatNumber(totalRuns)} hint="All recorded agent runs" icon={<MessageSquareText className="h-4 w-4" />} />
          <MetricCard label="Avg duration" value={formatDuration(dashboardSummary.avgDurationMs)} hint="Based on recent runs" icon={<Loader2 className="h-4 w-4" />} />
          <MetricCard label="Success rate" value={`${dashboardSummary.successRate}%`} hint="Completed vs failed" icon={<CheckCircle2 className="h-4 w-4" />} />
          <MetricCard label="Top tool" value={dashboardSummary.mostUsedTool} hint="Most frequently used action" icon={<Settings2 className="h-4 w-4" />} />
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTabId)} className="mt-2 sm:mt-6">
        <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="mb-4 flex min-w-max flex-nowrap justify-start gap-1 rounded-2xl border border-zinc-200 bg-white/70 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 sm:w-full sm:min-w-0 sm:flex-wrap">
          <TabsTrigger value="activity" className="rounded-xl px-4">
            Activity
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl px-4">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="memories" className="rounded-xl px-4">
            Memories
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-xl px-4">
            Tasks
          </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity">
          <Card className="border-zinc-200/80 bg-white/85 dark:border-zinc-800/80 dark:bg-zinc-900/75">
            <CardHeader className="border-b border-zinc-200/70 dark:border-zinc-800/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Activity feed</CardTitle>
                  <CardDescription>Recent runs streamed from the agent telemetry table.</CardDescription>
                </div>
                <Button variant={refreshEnabled ? "brand" : "outline"} size="sm" className="rounded-full" onClick={() => setRefreshEnabled((value) => !value)}>
                  Auto-refresh {refreshEnabled ? "on" : "off"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-auto sm:h-[36rem]">
                <div className="space-y-3 p-4">
                  {activity.loading && activityRuns.length === 0 ? (
                    <StatePill icon={<Loader2 className="h-4 w-4 animate-spin" />} title="Loading activity" description="Pulling the latest runs from /api/dashboard/activity." />
                  ) : null}
                  {!activity.loading && activityRuns.length === 0 ? (
                    <EmptyState title="No activity yet" description="Agent runs will appear here once telemetry is flowing." />
                  ) : null}
                  <AnimatePresence>
                    {activityRuns.map((run) => (
                      <RunCard
                        key={run.id}
                        run={run}
                        expanded={expandedRunId === run.id}
                        onToggle={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
                      />
                    ))}
                  </AnimatePresence>
                  {activity.data.total && activityRuns.length < activity.data.total ? (
                    <div className="pt-2">
                      <Button variant="outline" className="w-full rounded-full" onClick={() => void loadMoreActivity()}>
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-zinc-200/80 bg-white/85 dark:border-zinc-800/80 dark:bg-zinc-900/75">
              <CardHeader>
                <CardTitle>Tool analytics</CardTitle>
                <CardDescription>Route-backed when available, otherwise derived from activity data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Total runs" value={formatNumber(analytics.data?.totalRuns ?? totalRuns)} />
                  <MiniStat label="Avg duration" value={formatDuration(analytics.data?.avgDurationMs ?? dashboardSummary.avgDurationMs)} />
                  <MiniStat label="Success rate" value={`${analytics.data?.successRate ?? dashboardSummary.successRate}%`} />
                </div>
                <div className="rounded-2xl border border-zinc-200/70 p-4 dark:border-zinc-800">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Daily activity</p>
                    <p className="text-xs text-zinc-400">Last 7 days</p>
                  </div>
                  <div className="grid h-44 grid-cols-7 items-end gap-2">
                    {dailyActivity.map((day) => {
                      const runs = day.runs ?? 0;
                      const heightPercent =
                        runs > 0
                          ? Math.max(12, Math.min(100, (runs / maxDailyActivityRuns) * 100))
                          : 6;
                      return (
                        <div key={day.date || day.dateLabel} className="flex h-full flex-col items-center justify-end gap-2">
                          <div className="flex w-full flex-1 items-end">
                            <div
                              className="w-full rounded-t-xl bg-gradient-to-t from-teal-500 to-cyan-400"
                              style={{ height: `${heightPercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-400">{day.dateLabel || formatDayLabel(day.date || "")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200/80 bg-white/85 dark:border-zinc-800/80 dark:bg-zinc-900/75">
              <CardHeader>
                <CardTitle>Top tools</CardTitle>
                <CardDescription>Usage, latency, and error rate across recent runs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(analytics.data?.toolUsage?.length ? analytics.data.toolUsage : dashboardSummary.toolUsage).map((tool) => (
                  <div key={tool.name} className="rounded-2xl border border-zinc-200/70 p-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{tool.name}</p>
                        <p className="text-xs text-zinc-400">{formatNumber(tool.count)} calls</p>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {tool.errorRate}% errors
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Avg {formatDuration(tool.avgDurationMs)}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Last used {tool.lastUsed}</span>
                    </div>
                  </div>
                ))}
                {!analytics.available ? (
                  <StatePill icon={<ShieldAlert className="h-4 w-4" />} title="Analytics route pending" description="The UI falls back to activity-derived metrics until /api/dashboard/analytics is live." />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="memories">
          <Card className="border-zinc-200/80 bg-white/85 dark:border-zinc-800/80 dark:bg-zinc-900/75">
            <CardHeader className="border-b border-zinc-200/70 dark:border-zinc-800/70">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Memory browser</CardTitle>
                  <CardDescription>Search, edit, and delete long-term memories.</CardDescription>
                </div>
                <div className="flex w-full gap-2 lg:max-w-md">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Search memories" className="pl-9" />
                  </div>
                  <Button variant="brand" onClick={() => setNewMemoryOpen(true)}>
                    Add memory
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {newMemoryOpen ? (
                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-4">
                  <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                    <Input
                      value={newMemoryDraft.topic}
                      onChange={(event) => setNewMemoryDraft((prev) => ({ ...prev, topic: event.target.value }))}
                      placeholder="Topic"
                    />
                    <Input
                      value={newMemoryDraft.content}
                      onChange={(event) => setNewMemoryDraft((prev) => ({ ...prev, content: event.target.value }))}
                      placeholder="Memory content"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void handleMemoryCreate()} disabled={!memories.available}>
                      Save memory
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNewMemoryOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
              {memories.loading ? (
                <StatePill icon={<Loader2 className="h-4 w-4 animate-spin" />} title="Loading memories" description="Fetching from /api/dashboard/memories." />
              ) : null}
              {!memories.loading && filteredMemories.length === 0 ? (
                <EmptyState title="No memories match" description="Try another search or add a new memory." />
              ) : null}
              <div className="grid gap-3">
                {filteredMemories.map((memory) => {
                  const isEditing = editingMemoryId === memory.id;
                  return (
                    <div key={memory.id} className="rounded-2xl border border-zinc-200/70 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          {isEditing && memoryDraft ? (
                            <div className="space-y-3">
                              <Input
                                value={memoryDraft.topic}
                                onChange={(event) => setMemoryDraft((prev) => prev ? { ...prev, topic: event.target.value } : prev)}
                                placeholder="Topic"
                              />
                              <textarea
                                value={memoryDraft.content}
                                onChange={(event) => setMemoryDraft((prev) => prev ? { ...prev, content: event.target.value } : prev)}
                                rows={4}
                                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-semibold">{memory.topic}</p>
                              <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{memory.content}</p>
                              <p className="mt-2 text-xs text-zinc-400">{formatTimestamp(memory.updated_at)}</p>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={() => void handleMemorySave(memory.id)} disabled={!memories.available}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingMemoryId(null); setMemoryDraft(null); }}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!memories.available}
                                onClick={() => {
                                  setEditingMemoryId(memory.id);
                                  setMemoryDraft({ id: memory.id, topic: memory.topic, content: memory.content });
                                }}
                              >
                                <PencilLine className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                disabled={!memories.available}
                                onClick={() => void handleMemoryDelete(memory.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!memories.available ? (
                <StatePill icon={<ShieldAlert className="h-4 w-4" />} title="Memories route pending" description="This tab is wired to the planned /api/dashboard/memories endpoints and will activate when they land." />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="border-zinc-200/80 bg-white/85 dark:border-zinc-800/80 dark:bg-zinc-900/75">
            <CardHeader className="border-b border-zinc-200/70 dark:border-zinc-800/70">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Task manager</CardTitle>
                  <CardDescription>Inspect and control scheduled jobs from the control plane.</CardDescription>
                </div>
                <div className="flex w-full gap-2 lg:max-w-md">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="Search tasks" className="pl-9" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {tasks.loading ? (
                <StatePill icon={<Loader2 className="h-4 w-4 animate-spin" />} title="Loading tasks" description="Fetching from /api/dashboard/tasks." />
              ) : null}
              {!tasks.loading && filteredTasks.length === 0 ? (
                <EmptyState title="No tasks yet" description="Scheduled tasks will appear here once the task route is live." />
              ) : null}
              <div className="grid gap-3">
                {filteredTasks.map((task) => {
                  return (
                    <div key={task.id} className="rounded-2xl border border-zinc-200/70 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full">
                              {task.type}
                            </Badge>
                            <Badge variant={task.enabled ? "default" : "secondary"} className="rounded-full">
                              {task.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-medium">{task.description}</p>
                          <div className="mt-2 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                            <span>Schedule: {task.cron_expression || task.run_at || "not set"}</span>
                            <span>Last run: {formatTimestamp(task.last_run_at)}</span>
                            <span>Next run: {formatTimestamp(task.next_run_at)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => void handleTaskToggle(task)} disabled={!tasks.available}>
                            {task.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => void handleTaskRunNow(task.id)} disabled={!tasks.available}>
                            <Play className="h-4 w-4" />
                            Run now
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => void handleTaskDelete(task.id)}
                            disabled={!tasks.available}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!tasks.available ? (
                <StatePill icon={<ShieldAlert className="h-4 w-4" />} title="Tasks route pending" description="The task manager is wired to /api/dashboard/tasks, which is not live yet in this branch." />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-zinc-200/80 bg-white/85 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-zinc-100 p-3 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">{icon}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RunCard({
  run,
  expanded,
  onToggle,
}: {
  run: AgentRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      layout
      onClick={onToggle}
      className="w-full rounded-2xl border border-zinc-200/70 bg-white/75 p-4 text-left shadow-sm transition hover:border-teal-500/30 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/70"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full">
              {run.source}
            </Badge>
            <RunStatusBadge status={run.status} />
            <span className="text-xs text-zinc-400">{formatTimestamp(run.started_at)}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-200">
            {run.input_preview || "No preview available"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
              Duration {formatDuration(run.duration_ms)}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
              {run.tool_calls?.length || 0} tool calls
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
              Conversation {run.conversation_id ? run.conversation_id.slice(0, 8) : "n/a"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <EllipsisVertical className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
        </div>
      </div>

      <AnimatePresence>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="grid gap-3 lg:grid-cols-2">
                <DetailBlock title="Output preview" content={run.output_preview || "No assistant output captured yet."} />
                <DetailBlock title="Error" content={run.error || "No error recorded."} />
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Tool calls</p>
                {run.tool_calls?.length ? (
                  run.tool_calls.map((call) => (
                    <div key={call.callId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", call.status === "done" ? "bg-emerald-500" : "bg-red-500")} />
                        <span className="font-medium">{call.name}</span>
                        <span className="text-xs text-zinc-400">{call.callId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{formatDuration(call.durationMs)}</span>
                        <Badge variant="outline" className="rounded-full">
                          {call.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No tool calls captured.</p>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}

function RunStatusBadge({ status }: { status: AgentRun["status"] }) {
  const styles =
    status === "completed"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "failed"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : status === "timeout"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";

  return <Badge className={cn("rounded-full border-0", styles)}>{status}</Badge>;
}

function DetailBlock({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {content}
      </p>
    </div>
  );
}

function StatePill({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-zinc-100 p-2 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-6 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

async function fetchDashboardJson<T>(url: string): Promise<{ available: boolean; error: string | null; data: T | null }> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) {
      return { available: false, error: null, data: null };
    }
    if (!response.ok) {
      return { available: true, error: `Request failed: ${response.status}`, data: null };
    }
    const data = (await response.json()) as T;
    return { available: true, error: null, data };
  } catch (error) {
    return {
      available: true,
      error: error instanceof Error ? error.message : "Failed to load dashboard data",
      data: null,
    };
  }
}

function normalizeActivity(payload: DashboardActivityResponse | null): DashboardActivityResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const runs = Array.isArray(payload.runs) ? payload.runs : [];
  return {
    runs,
    total: typeof payload.total === "number" ? payload.total : runs.length,
    limit: typeof payload.limit === "number" ? payload.limit : INITIAL_ACTIVITY_LIMIT,
    offset: typeof payload.offset === "number" ? payload.offset : 0,
  };
}

function normalizeAnalytics(payload: DashboardAnalyticsResponse | null): DashboardAnalyticsResponse | null {
  if (!payload || typeof payload !== "object") return null;
  return {
    totalRuns: numberOr(payload.totalRuns),
    avgDurationMs: numberOr(payload.avgDurationMs),
    successRate: numberOr(payload.successRate),
    mostUsedTool: typeof payload.mostUsedTool === "string" ? payload.mostUsedTool : "",
    toolUsage: Array.isArray(payload.toolUsage)
      ? payload.toolUsage.map((tool) => ({
          name: typeof tool.name === "string" ? tool.name : "unknown",
          count: numberOr(tool.count),
          avgDurationMs: numberOr(tool.avgDurationMs),
          errorRate: numberOr(tool.errorRate),
          lastUsed: typeof tool.lastUsed === "string" ? tool.lastUsed : "n/a",
        }))
      : [],
    dailyActivity: Array.isArray(payload.dailyActivity)
      ? payload.dailyActivity.map((day) => ({
          date: typeof day.date === "string" ? day.date : "n/a",
          runs: numberOr(day.runs),
        }))
      : [],
  };
}

function normalizeMemoryList(payload: DashboardMemoryResponse | null): UserMemory[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray(payload.memories)) return payload.memories;
  return [];
}

function normalizeTaskList(payload: DashboardTaskResponse | null): DashboardTask[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray(payload.tasks)) return payload.tasks;
  return [];
}

function buildSummary(runs: AgentRun[], analyticsData: DashboardAnalyticsResponse | null) {
  const toolCounts = new Map<string, { count: number; duration: number; lastUsed: string }>();
  let completed = 0;
  let durationSum = 0;
  const dailyMap = new Map<string, number>();

  for (const run of runs) {
    if (run.status === "completed") completed += 1;
    if (typeof run.duration_ms === "number") durationSum += run.duration_ms;

    const dayKey = run.started_at.slice(0, 10);
    dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);

    for (const call of run.tool_calls || []) {
      const current = toolCounts.get(call.name) || { count: 0, duration: 0, lastUsed: run.started_at };
      current.count += 1;
      current.duration += call.durationMs;
      current.lastUsed = run.started_at;
      toolCounts.set(call.name, current);
    }
  }

  const toolUsage = Array.from(toolCounts.entries())
    .map(([name, entry]) => ({
      name,
      count: entry.count,
      avgDurationMs: entry.count ? entry.duration / entry.count : 0,
      errorRate: 0,
      lastUsed: formatTimestamp(entry.lastUsed),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const dailyActivity = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, runsCount]) => ({
      date,
      dateLabel: formatDayLabel(date),
      runs: runsCount,
    }));

  const mostUsedTool = toolUsage[0]?.name || analyticsData?.mostUsedTool || "n/a";

  return {
    successRate: runs.length ? Math.round((completed / runs.length) * 100) : 0,
    avgDurationMs: runs.length ? Math.round(durationSum / runs.length) : 0,
    toolUsage: toolUsage.length ? toolUsage : [{ name: "n/a", count: 0, avgDurationMs: 0, errorRate: 0, lastUsed: "n/a" }],
    dailyActivity: dailyActivity.length
      ? dailyActivity
      : Array.from({ length: 7 }).map((_, index) => ({
          date: `day-${index}`,
          dateLabel: String(index + 1),
          runs: 0,
        })),
    mostUsedTool,
  };
}

function formatDuration(value: number | string | null | undefined) {
  const duration = typeof value === "number" ? value : 0;
  if (!duration) return "0ms";
  if (duration < 1_000) return `${Math.round(duration)}ms`;
  return `${(duration / 1_000).toFixed(1)}s`;
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDayLabel(value: string) {
  if (!value || value.startsWith("day-")) return value.replace("day-", "");
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(value));
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2).toUpperCase();
}

function numberOr(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
