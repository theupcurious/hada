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
import {
  cronRecurrenceLabel,
  formatNextRunExact,
  getUserTimeZone,
} from "@/lib/workflows/schedule";
import {
  WORKFLOW_FREQUENCY_LABELS,
  localScheduleToCron,
  type WorkflowFrequency,
} from "@/lib/workflows/templates";

type DashboardTask = ScheduledTask & { next_run_at?: string | null };

type TasksResponse = {
  tasks?: DashboardTask[];
  error?: string;
};

type SpaceOption = { id: string; name: string; emoji: string | null };

type WorkflowRun = {
  id: string;
  status: "running" | "completed" | "failed" | "timeout";
  started_at: string;
  duration_ms: number | null;
  output_preview: string | null;
  error: string | null;
};

const FREQUENCIES: WorkflowFrequency[] = ["daily", "weekdays", "weekly_monday"];

/** Friendly one-line schedule for an active workflow. */
function describeSchedule(task: DashboardTask, tz: string, copy: TasksCopy): string {
  if (task.type === "once") {
    return task.run_at ? `${copy.oneTime} · ${formatNextRunExact(new Date(task.run_at), tz)}` : copy.oneTime;
  }
  if (!task.cron_expression) return copy.recurring;
  return cronRecurrenceLabel(task.cron_expression, tz) ?? copy.recurring;
}

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
  const tz = getUserTimeZone();
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(new Set<string>());
  const [pending, setPending] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, { message: string; resultUrl?: string; failed?: boolean }>>({});
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  useEffect(() => {
    void fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { projects?: SpaceOption[] } | null) => {
        if (data?.projects) setSpaces(data.projects);
      })
      .catch(() => {});
  }, []);

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

  const saveEdit = async (
    taskId: string,
    updates: { description?: string; cron_expression?: string; project_id?: string | null },
  ) => {
    const response = await fetch(`/api/dashboard/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || copy.editFailed);
    }
    setEditingId(null);
    await loadTasks();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.subtitle}</p>
      </div>

      {/* Active workflows first, so existing automations are visible on arrival. */}
      {(loading || tasks.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{copy.activeWorkflows}</h2>

          {loading && <p className="text-sm text-zinc-400">{copy.loadingTasks}</p>}

          {error && (
            <Card className="border-red-200 dark:border-red-900">
              <CardContent className="pt-6">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
                        {describeSchedule(task, tz, copy)}
                      </Badge>
                      {task.next_run_at && task.enabled && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {copy.next}: {formatNextRun(task.next_run_at, copy)}
                        </span>
                      )}
                      {!task.enabled && <span className="text-xs text-zinc-400">{copy.paused}</span>}
                    </div>
                    {task.cron_expression && (
                      <details className="mt-1.5 text-xs text-zinc-400">
                        <summary className="cursor-pointer select-none">{copy.advanced}</summary>
                        <code className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800">
                          {task.cron_expression} (UTC)
                        </code>
                      </details>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={Boolean(pending[task.id]) || Boolean(task.execution_token && task.execution_started_at && Date.now() - new Date(task.execution_started_at).getTime() < 600_000)}
                      onClick={() => void handleRunNow(task.id)}
                    >
                      {pending[task.id] === "run" || Boolean(task.execution_token && task.execution_started_at && Date.now() - new Date(task.execution_started_at).getTime() < 600_000) ? "Running…" : copy.runNow}
                    </Button>
                    <Button variant="outline" size="sm" disabled={Boolean(pending[task.id])} onClick={() => void handleToggle(task)}>
                      {task.enabled ? copy.pause : copy.resume}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(pending[task.id])}
                      onClick={() => setEditingId((id) => (id === task.id ? null : task.id))}
                    >
                      {copy.edit}
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

              <CardContent className="space-y-3 pt-0">
                {editingId === task.id ? (
                  <WorkflowEditor
                    task={task}
                    spaces={spaces}
                    copy={copy}
                    onCancel={() => setEditingId(null)}
                    onSave={(updates) => saveEdit(task.id, updates)}
                  />
                ) : null}

                {(pending[task.id] || outcomes[task.id]) && (
                  <div>
                    <p role={outcomes[task.id]?.failed ? "alert" : "status"} className={outcomes[task.id]?.failed ? "text-sm text-red-600 dark:text-red-400" : "text-sm text-zinc-500"}>
                      {pending[task.id] === "run" ? "Running your workflow. This can take a few minutes…" : pending[task.id] ? "Updating workflow…" : outcomes[task.id]?.message}
                    </p>
                    {!pending[task.id] && outcomes[task.id]?.resultUrl && (
                      <Link className="mt-2 inline-block text-sm text-teal-700 underline dark:text-teal-300" href={outcomes[task.id].resultUrl!}>
                        {copy.openResult}
                      </Link>
                    )}
                  </div>
                )}

                <RunHistory taskId={task.id} tz={tz} copy={copy} />
              </CardContent>
            </Card>
          ))}

          {!loading && !error && tasks.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{copy.noTasksYet}</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{copy.noTasksHint}</p>
              </CardContent>
            </Card>
          )}

          {!loading && tasks.length > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => void loadTasks()} disabled={loading}>
                {loading ? copy.refreshing : copy.refresh}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Template gallery below the active list. */}
      <div>
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{copy.startWorkflow}</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{copy.startWorkflowHint}</p>
        <div className="mt-3">
          <WorkflowGallery onCreated={loadTasks} />
        </div>
      </div>

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

/** Inline editor for an existing workflow: instructions, Space, and schedule. */
function WorkflowEditor({
  task,
  spaces,
  copy,
  onCancel,
  onSave,
}: {
  task: DashboardTask;
  spaces: SpaceOption[];
  copy: TasksCopy;
  onCancel: () => void;
  onSave: (updates: { description?: string; cron_expression?: string; project_id?: string | null }) => Promise<void>;
}) {
  const [description, setDescription] = useState(task.description);
  const [projectId, setProjectId] = useState(task.project_id ?? "");
  const [changeSchedule, setChangeSchedule] = useState(false);
  const [frequency, setFrequency] = useState<WorkflowFrequency>("weekdays");
  const [time, setTime] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const updates: { description?: string; cron_expression?: string; project_id?: string | null } = {};
      if (description.trim() && description.trim() !== task.description) updates.description = description.trim();
      if ((projectId || null) !== (task.project_id ?? null)) updates.project_id = projectId || null;
      if (changeSchedule && task.type === "recurring") {
        updates.cron_expression = localScheduleToCron(frequency, time, new Date().getTimezoneOffset());
      }
      if (Object.keys(updates).length === 0) {
        onCancel();
        return;
      }
      await onSave(updates);
    } catch (e) {
      setErr(e instanceof Error ? e.message : copy.editFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {copy.instructions}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full resize-none rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {copy.spaceLabel}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mt-1 block h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">{copy.general}</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji?.trim() ? `${s.emoji} ` : ""}
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {task.type === "recurring" ? (
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={changeSchedule}
              onChange={(e) => setChangeSchedule(e.target.checked)}
              className="h-4 w-4 accent-teal-600"
            />
            {copy.changeSchedule}
          </label>
          {changeSchedule ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {copy.frequency}
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as WorkflowFrequency)}
                  className="mt-1 block h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {WORKFLOW_FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {copy.timeLabel}
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 block h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {err ? <p className="text-xs text-red-600 dark:text-red-400">{err}</p> : null}

      <div className="flex gap-2">
        <Button size="sm" variant="brand" className="rounded-full" disabled={saving} onClick={() => void submit()}>
          {saving ? copy.saving : copy.saveChanges}
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={saving} onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  );
}

/** Collapsible recent-run history for a single workflow. */
function RunHistory({ taskId, tz, copy }: { taskId: string; tz: string; copy: TasksCopy }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/tasks/${taskId}/runs`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { runs?: WorkflowRun[] };
        setRuns(data.runs ?? []);
      } else {
        setRuns([]);
      }
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && runs === null) void load();
  };

  return (
    <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {open ? copy.hideRuns : copy.runHistory}
      </button>
      {open ? (
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-zinc-400">{copy.loadingRuns}</p>
          ) : runs && runs.length > 0 ? (
            <ul className="space-y-1.5">
              {runs.map((run) => (
                <li key={run.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      run.status === "completed"
                        ? "text-teal-600 dark:text-teal-400"
                        : run.status === "running"
                        ? "text-amber-500"
                        : "text-red-500"
                    }
                  >
                    ●
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {formatNextRunExact(new Date(run.started_at), tz)}
                  </span>
                  <span className="text-zinc-400">· {copy.statusLabel(run.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-400">{copy.noRuns}</p>
          )}
        </div>
      ) : null}
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
  noTasksYet: string;
  noTasksHint: string;
  recurring: string;
  oneTime: string;
  next: string;
  paused: string;
  runNow: string;
  pause: string;
  resume: string;
  edit: string;
  delete: string;
  cancel: string;
  refresh: string;
  refreshing: string;
  advanced: string;
  openResult: string;
  instructions: string;
  spaceLabel: string;
  general: string;
  changeSchedule: string;
  frequency: string;
  timeLabel: string;
  saveChanges: string;
  saving: string;
  editFailed: string;
  runHistory: string;
  hideRuns: string;
  loadingRuns: string;
  noRuns: string;
  statusLabel: (status: WorkflowRun["status"]) => string;
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
    startWorkflow: "Start a new workflow",
    startWorkflowHint: "Pick a template, choose when it runs, and Hada handles it for you.",
    activeWorkflows: "Active workflows",
    loadingTasks: "Loading workflows...",
    failedToLoadTasks: "Failed to load workflows.",
    confirmDeleteTask: "Delete this workflow?",
    noTasksYet: "No workflows yet.",
    noTasksHint: "Choose a template below, or just describe a workflow to Hada in chat.",
    recurring: "Recurring",
    oneTime: "One-time",
    next: "Next",
    paused: "Paused",
    runNow: "Run now",
    pause: "Pause",
    resume: "Resume",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    refresh: "Refresh",
    refreshing: "Refreshing...",
    advanced: "Advanced: cron schedule",
    openResult: "Open result",
    instructions: "Instructions",
    spaceLabel: "Space",
    general: "General",
    changeSchedule: "Change schedule",
    frequency: "Frequency",
    timeLabel: "Time",
    saveChanges: "Save changes",
    saving: "Saving...",
    editFailed: "Couldn’t save changes. Try again.",
    runHistory: "Run history",
    hideRuns: "Hide run history",
    loadingRuns: "Loading runs...",
    noRuns: "No runs yet.",
    statusLabel: (s) => (s === "completed" ? "Completed" : s === "running" ? "Running" : s === "timeout" ? "Timed out" : "Failed"),
    overdue: "overdue",
    inMinutes: (v) => `in ${v}m`,
    inHours: (v) => `in ${v}h`,
    inDays: (v) => `in ${v}d`,
    tomorrow: "tomorrow",
  },
  ko: {
    title: "워크플로우",
    subtitle: "Hada가 자동으로 작업을 실행하도록 설정하세요 — 한 번 만들면 일정에 따라 실행됩니다.",
    startWorkflow: "새 워크플로우 시작",
    startWorkflowHint: "템플릿을 고르고 실행 시점을 정하면 Hada가 알아서 처리합니다.",
    activeWorkflows: "활성 워크플로우",
    loadingTasks: "워크플로우를 불러오는 중...",
    failedToLoadTasks: "워크플로우를 불러오지 못했습니다.",
    confirmDeleteTask: "이 워크플로우를 삭제할까요?",
    noTasksYet: "아직 워크플로우가 없습니다.",
    noTasksHint: "아래 템플릿을 고르거나, 채팅에서 Hada에게 워크플로우를 설명해 보세요.",
    recurring: "반복",
    oneTime: "1회성",
    next: "다음 실행",
    paused: "일시중지됨",
    runNow: "지금 실행",
    pause: "일시중지",
    resume: "재개",
    edit: "편집",
    delete: "삭제",
    cancel: "취소",
    refresh: "새로고침",
    refreshing: "새로고침 중...",
    advanced: "고급: cron 일정",
    openResult: "결과 열기",
    instructions: "지시사항",
    spaceLabel: "스페이스",
    general: "일반",
    changeSchedule: "일정 변경",
    frequency: "빈도",
    timeLabel: "시간",
    saveChanges: "변경 사항 저장",
    saving: "저장 중...",
    editFailed: "변경 사항을 저장하지 못했습니다. 다시 시도하세요.",
    runHistory: "실행 기록",
    hideRuns: "실행 기록 숨기기",
    loadingRuns: "실행 기록 불러오는 중...",
    noRuns: "아직 실행 기록이 없습니다.",
    statusLabel: (s) => (s === "completed" ? "완료" : s === "running" ? "실행 중" : s === "timeout" ? "시간 초과" : "실패"),
    overdue: "기한 지남",
    inMinutes: (v) => `${v}분 후`,
    inHours: (v) => `${v}시간 후`,
    inDays: (v) => `${v}일 후`,
    tomorrow: "내일",
  },
  ja: {
    title: "ワークフロー",
    subtitle: "Hada に作業を自動実行させましょう — 一度設定すれば、スケジュール通りに実行されます。",
    startWorkflow: "新しいワークフローを開始",
    startWorkflowHint: "テンプレートを選び、実行タイミングを決めれば Hada が処理します。",
    activeWorkflows: "実行中のワークフロー",
    loadingTasks: "ワークフローを読み込み中...",
    failedToLoadTasks: "ワークフローの読み込みに失敗しました。",
    confirmDeleteTask: "このワークフローを削除しますか？",
    noTasksYet: "まだワークフローがありません。",
    noTasksHint: "下のテンプレートを選ぶか、チャットで Hada にワークフローを説明してください。",
    recurring: "繰り返し",
    oneTime: "1回のみ",
    next: "次回",
    paused: "一時停止中",
    runNow: "今すぐ実行",
    pause: "一時停止",
    resume: "再開",
    edit: "編集",
    delete: "削除",
    cancel: "キャンセル",
    refresh: "更新",
    refreshing: "更新中...",
    advanced: "詳細: cron スケジュール",
    openResult: "結果を開く",
    instructions: "指示",
    spaceLabel: "スペース",
    general: "一般",
    changeSchedule: "スケジュールを変更",
    frequency: "頻度",
    timeLabel: "時刻",
    saveChanges: "変更を保存",
    saving: "保存中...",
    editFailed: "変更を保存できませんでした。もう一度お試しください。",
    runHistory: "実行履歴",
    hideRuns: "実行履歴を隠す",
    loadingRuns: "実行履歴を読み込み中...",
    noRuns: "まだ実行履歴がありません。",
    statusLabel: (s) => (s === "completed" ? "完了" : s === "running" ? "実行中" : s === "timeout" ? "タイムアウト" : "失敗"),
    overdue: "期限切れ",
    inMinutes: (v) => `${v}分後`,
    inHours: (v) => `${v}時間後`,
    inDays: (v) => `${v}日後`,
    tomorrow: "明日",
  },
  zh: {
    title: "工作流",
    subtitle: "让 Hada 自动替你执行任务 —— 设置一次，按计划自动运行。",
    startWorkflow: "创建新工作流",
    startWorkflowHint: "选择模板、设定运行时间，Hada 会自动帮你处理。",
    activeWorkflows: "运行中的工作流",
    loadingTasks: "正在加载工作流...",
    failedToLoadTasks: "加载工作流失败。",
    confirmDeleteTask: "要删除这个工作流吗？",
    noTasksYet: "还没有工作流。",
    noTasksHint: "选择下方的模板，或直接在聊天中向 Hada 描述一个工作流。",
    recurring: "循环",
    oneTime: "一次性",
    next: "下次执行",
    paused: "已暂停",
    runNow: "立即执行",
    pause: "暂停",
    resume: "继续",
    edit: "编辑",
    delete: "删除",
    cancel: "取消",
    refresh: "刷新",
    refreshing: "刷新中...",
    advanced: "高级：cron 计划",
    openResult: "打开结果",
    instructions: "指令",
    spaceLabel: "空间",
    general: "通用",
    changeSchedule: "更改计划",
    frequency: "频率",
    timeLabel: "时间",
    saveChanges: "保存更改",
    saving: "保存中...",
    editFailed: "无法保存更改。请重试。",
    runHistory: "运行历史",
    hideRuns: "隐藏运行历史",
    loadingRuns: "正在加载运行记录...",
    noRuns: "还没有运行记录。",
    statusLabel: (s) => (s === "completed" ? "已完成" : s === "running" ? "运行中" : s === "timeout" ? "超时" : "失败"),
    overdue: "已过期",
    inMinutes: (v) => `${v} 分钟后`,
    inHours: (v) => `${v} 小时后`,
    inDays: (v) => `${v} 天后`,
    tomorrow: "明天",
  },
};
