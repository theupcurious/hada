"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WorkflowGallery } from "@/components/settings/workflow-gallery";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import type { ScheduledTask } from "@/lib/types/database";

type DashboardTask = ScheduledTask & { next_run_at?: string | null };

type TasksResponse = {
  tasks?: DashboardTask[];
  error?: string;
};

function formatNextRun(iso: string | null | undefined, copy: TasksCopy): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) return copy.overdue;
  if (diffMins < 60) return copy.inMinutes(diffMins);
  if (diffHours < 24) return copy.inHours(diffHours);
  if (diffDays === 1) return copy.tomorrow;
  return copy.inDays(diffDays);
}

export function TasksTab() {
  const locale = useResolvedLocale();
  const copy = TASKS_COPY[locale];
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(new Set<string>());
  const [pending, setPending] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, { message: string; resultUrl?: string; failed?: boolean }>>({});
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/tasks");
      if (!response.ok) {
        setError(copy.failedToLoadTasks);
        return;
      }
      const data = (await response.json()) as TasksResponse | DashboardTask[];
      const list: DashboardTask[] = Array.isArray(data) ? data : (data?.tasks ?? []);
      setTasks(list);
    } catch {
      setError(copy.failedToLoadTasks);
    } finally {
      setLoading(false);
    }
  }, [copy.failedToLoadTasks]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const mutateTask = async (taskId: string, action: "run" | "pause" | "resume" | "delete") => {
    if (busyRef.current.has(taskId)) return;
    busyRef.current.add(taskId);
    setPending((prev) => ({ ...prev, [taskId]: action }));
    setError(null);
    setOutcomes((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    try {
      const response = await fetch(`/api/dashboard/tasks/${taskId}${action === "run" ? "/run" : ""}`, {
        method: action === "run" ? "POST" : action === "delete" ? "DELETE" : "PATCH",
        ...(action === "pause" || action === "resume" ? {
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: action === "resume" }),
        } : {}),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; resultUrl?: string };
      if (!response.ok) {
        setOutcomes((prev) => ({ ...prev, [taskId]: {
          message: payload.error || `Couldn’t ${action} this workflow. Try again.`,
          resultUrl: payload.resultUrl, failed: true,
        } }));
        return;
      }
      if (action === "delete") setTaskToDelete(null);
      else setOutcomes((prev) => ({ ...prev, [taskId]: { message: payload.message || (action === "pause" ? "Workflow paused." : "Workflow resumed."), resultUrl: payload.resultUrl } }));
      await loadTasks();
    } catch {
      setOutcomes((prev) => ({ ...prev, [taskId]: { message: "Connection lost. Refresh to check the workflow before trying again.", failed: true } }));
    } finally {
      busyRef.current.delete(taskId);
      setPending((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
      if (action === "delete") setTaskToDelete(null);
    }
  };
  useEffect(() => {
    if (!tasks.some((task) => task.execution_token)) return;
    const timer = window.setInterval(() => { void loadTasks(); }, 5000);
    return () => window.clearInterval(timer);
  }, [tasks, loadTasks]);

  const handleToggle = (task: DashboardTask) => mutateTask(task.id, task.enabled ? "pause" : "resume");
  const handleDelete = (taskId: string) => mutateTask(taskId, "delete");
  const handleRunNow = (taskId: string) => mutateTask(taskId, "run");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {copy.subtitle}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{copy.startWorkflow}</h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{copy.startWorkflowHint}</p>
        <div className="mt-3">
          <WorkflowGallery onCreated={loadTasks} />
        </div>
      </div>

      {(loading || tasks.length > 0) && (
        <h3 className="pt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {copy.activeWorkflows}
        </h3>
      )}

      {loading && (
        <p className="text-sm text-zinc-400">{copy.loadingTasks}</p>
      )}

      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && tasks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{copy.noTasksYet}</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {copy.noTasksHint}
            </p>
          </CardContent>
        </Card>
      )}

      {tasks.map((task) => (
        <Card key={task.id} className={task.enabled ? "" : "opacity-60"}>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-medium">{task.description}</CardTitle>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    {task.type === "recurring" ? copy.recurring : copy.oneTime}
                  </Badge>
                  {task.cron_expression && (
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800">
                      {task.cron_expression}
                    </code>
                  )}
                  {task.next_run_at && task.enabled && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {copy.next}: {formatNextRun(task.next_run_at, copy)}
                    </span>
                  )}
                  {!task.enabled && (
                    <span className="text-xs text-zinc-400">{copy.paused}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Boolean(pending[task.id]) || Boolean(task.execution_token && task.execution_started_at && Date.now() - new Date(task.execution_started_at).getTime() < 600_000)}
                  onClick={() => void handleRunNow(task.id)}
                >
                  {pending[task.id] === "run" || Boolean(task.execution_token && task.execution_started_at && Date.now() - new Date(task.execution_started_at).getTime() < 600_000) ? "Running…" : copy.runNow}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Boolean(pending[task.id])}
                  onClick={() => void handleToggle(task)}
                >
                  {task.enabled ? copy.pause : copy.resume}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 dark:text-red-400"
                  disabled={Boolean(pending[task.id])}
                  onClick={() => setTaskToDelete(task.id)}
                >
                  {copy.delete}
                </Button>
              </div>
            </div>
          </CardHeader>
          {(pending[task.id] || outcomes[task.id]) && <CardContent className="pt-0">
            <p role={outcomes[task.id]?.failed ? "alert" : "status"} className={outcomes[task.id]?.failed ? "text-sm text-red-600 dark:text-red-400" : "text-sm text-zinc-500"}>
              {pending[task.id] === "run" ? "Running your workflow. This can take a few minutes…" : pending[task.id] ? "Updating workflow…" : outcomes[task.id]?.message}
            </p>
            {!pending[task.id] && outcomes[task.id]?.resultUrl && <Link className="mt-2 inline-block text-sm text-teal-700 underline dark:text-teal-300" href={outcomes[task.id].resultUrl!}>Open result</Link>}
          </CardContent>}
        </Card>
      ))}

      {!loading && tasks.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void loadTasks()} disabled={loading}>
            {loading ? copy.refreshing : copy.refresh}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={taskToDelete !== null}
        title={copy.confirmDeleteTask}
        confirmLabel={copy.delete}
        cancelLabel={copy.cancel}
        destructive
        busy={Boolean(taskToDelete && pending[taskToDelete])}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        onConfirm={() => {
          if (taskToDelete) return handleDelete(taskToDelete);
        }}
      />
    </div>
  );
}

type TasksCopy = {
  title: string;
  subtitle: string;
  startWorkflow: string;
  startWorkflowHint: string;
  activeWorkflows: string;
  loadingTasks: string;
  failedToLoadTasks: string;
  confirmDeleteTask: string;
  runFailedWithStatus: (status: number) => string;
  noTasksYet: string;
  noTasksHint: string;
  recurring: string;
  oneTime: string;
  next: string;
  paused: string;
  runNow: string;
  pause: string;
  resume: string;
  delete: string;
  cancel: string;
  refresh: string;
  refreshing: string;
  overdue: string;
  inMinutes: (v: number) => string;
  inHours: (v: number) => string;
  inDays: (v: number) => string;
  tomorrow: string;
};

const TASKS_COPY: Record<AppLocale, TasksCopy> = {
  en: {
    title: "Workflows",
    subtitle: "Set Hada to run jobs for you automatically — build it once, it runs on schedule.",
    startWorkflow: "Start a workflow",
    startWorkflowHint: "Pick a template, choose when it runs, and Hada handles it for you.",
    activeWorkflows: "Active workflows",
    loadingTasks: "Loading tasks...",
    failedToLoadTasks: "Failed to load tasks.",
    confirmDeleteTask: "Delete this task?",
    runFailedWithStatus: (status) => `Run failed with status ${status}.`,
    noTasksYet: "No scheduled tasks yet.",
    noTasksHint: "Ask Hada to schedule a task for you in chat.",
    recurring: "Recurring",
    oneTime: "One-time",
    next: "Next",
    paused: "Paused",
    runNow: "Run now",
    pause: "Pause",
    resume: "Resume",
    delete: "Delete",
    cancel: "Cancel",
    refresh: "Refresh",
    refreshing: "Refreshing...",
    overdue: "overdue",
    inMinutes: (v) => `in ${v}m`,
    inHours: (v) => `in ${v}h`,
    inDays: (v) => `in ${v}d`,
    tomorrow: "tomorrow",
  },
  ko: {
    title: "워크플로우",
    subtitle: "Hada가 자동으로 작업을 실행하도록 설정하세요 — 한 번 만들면 일정에 따라 실행됩니다.",
    startWorkflow: "워크플로우 시작",
    startWorkflowHint: "템플릿을 고르고 실행 시점을 정하면 Hada가 알아서 처리합니다.",
    activeWorkflows: "활성 워크플로우",
    loadingTasks: "작업을 불러오는 중...",
    failedToLoadTasks: "작업을 불러오지 못했습니다.",
    confirmDeleteTask: "이 작업을 삭제할까요?",
    runFailedWithStatus: (status) => `실행 실패 (상태 코드 ${status}).`,
    noTasksYet: "예약된 작업이 아직 없습니다.",
    noTasksHint: "채팅에서 Hada에게 작업 예약을 요청해 보세요.",
    recurring: "반복",
    oneTime: "1회성",
    next: "다음 실행",
    paused: "일시중지됨",
    runNow: "지금 실행",
    pause: "일시중지",
    resume: "재개",
    delete: "삭제",
    cancel: "취소",
    refresh: "새로고침",
    refreshing: "새로고침 중...",
    overdue: "기한 지남",
    inMinutes: (v) => `${v}분 후`,
    inHours: (v) => `${v}시간 후`,
    inDays: (v) => `${v}일 후`,
    tomorrow: "내일",
  },
  ja: {
    title: "ワークフロー",
    subtitle: "Hada に作業を自動実行させましょう — 一度設定すれば、スケジュール通りに実行されます。",
    startWorkflow: "ワークフローを開始",
    startWorkflowHint: "テンプレートを選び、実行タイミングを決めれば Hada が処理します。",
    activeWorkflows: "実行中のワークフロー",
    loadingTasks: "タスクを読み込み中...",
    failedToLoadTasks: "タスクの読み込みに失敗しました。",
    confirmDeleteTask: "このタスクを削除しますか？",
    runFailedWithStatus: (status) => `実行に失敗しました（ステータス ${status}）。`,
    noTasksYet: "スケジュールされたタスクはまだありません。",
    noTasksHint: "チャットで Hada にタスク作成を依頼してください。",
    recurring: "繰り返し",
    oneTime: "1回のみ",
    next: "次回",
    paused: "一時停止中",
    runNow: "今すぐ実行",
    pause: "一時停止",
    resume: "再開",
    delete: "削除",
    cancel: "キャンセル",
    refresh: "更新",
    refreshing: "更新中...",
    overdue: "期限切れ",
    inMinutes: (v) => `${v}分後`,
    inHours: (v) => `${v}時間後`,
    inDays: (v) => `${v}日後`,
    tomorrow: "明日",
  },
  zh: {
    title: "工作流",
    subtitle: "让 Hada 自动替你执行任务 —— 设置一次，按计划自动运行。",
    startWorkflow: "启动工作流",
    startWorkflowHint: "选择模板、设定运行时间，Hada 会自动帮你处理。",
    activeWorkflows: "运行中的工作流",
    loadingTasks: "正在加载任务...",
    failedToLoadTasks: "加载任务失败。",
    confirmDeleteTask: "要删除这个任务吗？",
    runFailedWithStatus: (status) => `执行失败，状态码 ${status}。`,
    noTasksYet: "还没有定时任务。",
    noTasksHint: "在聊天中让 Hada 帮你安排一个任务。",
    recurring: "循环",
    oneTime: "一次性",
    next: "下次执行",
    paused: "已暂停",
    runNow: "立即执行",
    pause: "暂停",
    resume: "继续",
    delete: "删除",
    cancel: "取消",
    refresh: "刷新",
    refreshing: "刷新中...",
    overdue: "已过期",
    inMinutes: (v) => `${v} 分钟后`,
    inHours: (v) => `${v} 小时后`,
    inDays: (v) => `${v} 天后`,
    tomorrow: "明天",
  },
};
