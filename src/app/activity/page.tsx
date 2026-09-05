"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Globe,
  MessageSquare,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getToolLabel } from "@/lib/chat/tool-labels";
import type { AgentRun } from "@/lib/types/database";

const PAGE_SIZE = 25;

/** A run enriched with the Space it belongs to (from the API). */
type RunProject = { id: string; name: string; emoji: string | null; color: string | null };
type ActivityRun = AgentRun & { project?: RunProject | null };

type StatusFilter = "all" | "completed" | "failed" | "running";
type ProjectFilter = "all" | "general" | string;

export default function ActivityPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<ActivityRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [project, setProject] = useState<ProjectFilter>("all");
  const [projects, setProjects] = useState<RunProject[]>([]);

  const load = useCallback(
    async (offset: number) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (status !== "all") params.set("status", status);
        if (project !== "all") params.set("project", project);
        const res = await fetch(`/api/dashboard/activity?${params.toString()}`, { cache: "no-store" });
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load activity");
        const data = (await res.json()) as { runs?: ActivityRun[]; total?: number };
        setRuns((prev) => (offset === 0 ? data.runs ?? [] : [...prev, ...(data.runs ?? [])]));
        setTotal(data.total ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load activity");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [router, status, project],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  // The Space filter needs the user's Spaces to label the dropdown.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { projects?: RunProject[] } | null) => {
        if (!cancelled && data?.projects) setProjects(data.projects);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/chat">
          <Button variant="ghost" size="icon" aria-label="Back to chat" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Activity
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Everything your assistant has done — chats, scheduled runs, and the actions it took.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "completed", label: "Completed" },
            { value: "failed", label: "Failed" },
            { value: "running", label: "Running" },
          ]}
        />
        <FilterSelect
          label="Space"
          value={project}
          onChange={(v) => setProject(v as ProjectFilter)}
          options={[
            { value: "all", label: "All spaces" },
            { value: "general", label: "General" },
            ...projects.map((p) => ({ value: p.id, label: `${p.emoji?.trim() ? `${p.emoji} ` : ""}${p.name}` })),
          ]}
        />
      </div>

      {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading activity…</p>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {status !== "all" || project !== "all" ? "No activity matches these filters." : "No activity yet."}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {status !== "all" || project !== "all"
              ? "Try clearing the filters above."
              : "Once you chat or a scheduled workflow runs, it will show up here."}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {runs.map((run) => (
              <ActivityRow key={run.id} run={run} />
            ))}
          </ul>
          {runs.length < total ? (
            <div className="mt-5 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={loadingMore}
                onClick={() => void load(runs.length)}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Aggregate repeated tool calls into one badge per tool, e.g. "Searched the web ×3". */
function aggregateTools(tools: AgentRun["tool_calls"]): { key: string; label: string; count: number; error: boolean }[] {
  const map = new Map<string, { label: string; count: number; error: boolean }>();
  for (const tool of tools) {
    const label = getToolLabel(tool.name).past;
    const existing = map.get(tool.name);
    if (existing) {
      existing.count += 1;
      existing.error = existing.error || tool.status === "error";
    } else {
      map.set(tool.name, { label, count: 1, error: tool.status === "error" });
    }
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v }));
}

/** Strip Markdown markers so previews read as plain text, not raw source. */
function cleanExcerpt(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/\|/g, " ") // table pipes
    .replace(/\s+/g, " ")
    .trim();
}

/** Derive a readable status, including "Completed with warnings" from tool errors. */
function deriveStatus(run: AgentRun): {
  label: string;
  tone: "success" | "warning" | "error" | "running";
} {
  if (run.status === "running") return { label: "Running", tone: "running" };
  if (run.status === "failed") return { label: "Failed", tone: "error" };
  if (run.status === "timeout") return { label: "Timed out", tone: "error" };
  const hadToolError = Array.isArray(run.tool_calls) && run.tool_calls.some((t) => t.status === "error");
  if (hadToolError) return { label: "Completed with warnings", tone: "warning" };
  return { label: "Completed", tone: "success" };
}

function ActivityRow({ run }: { run: ActivityRun }) {
  const tools = Array.isArray(run.tool_calls) ? aggregateTools(run.tool_calls) : [];
  const title =
    (run.input_preview && run.input_preview.trim()) ||
    (run.source === "scheduled" ? "Scheduled run" : "Conversation");
  const status = deriveStatus(run);
  const excerpt = run.output_preview ? cleanExcerpt(run.output_preview) : "";
  // Link to the conversation this run happened in, carrying its Space.
  const resultHref =
    run.conversation_id
      ? run.project?.id
        ? `/chat?project=${run.project.id}`
        : "/chat"
      : null;

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
            <SourceBadge source={run.source} />
            {run.project ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  {run.project.emoji?.trim() ? (
                    <span aria-hidden>{run.project.emoji}</span>
                  ) : (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: run.project.color || "#14b8a6" }}
                    />
                  )}
                  {run.project.name}
                </span>
              </>
            ) : null}
            <span>·</span>
            <span>{formatRelativeTime(run.started_at)}</span>
            {typeof run.duration_ms === "number" ? (
              <>
                <span>·</span>
                <span>{formatDuration(run.duration_ms)}</span>
              </>
            ) : null}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {tools.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <span
              key={`${run.id}-tool-${tool.key}`}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px]",
                tool.error
                  ? "border-red-300/60 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300",
              )}
            >
              {tool.label}
              {tool.count > 1 ? ` ×${tool.count}` : ""}
              {tool.error ? " (failed)" : ""}
            </span>
          ))}
        </div>
      ) : null}

      {excerpt ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{excerpt}</p>
      ) : null}

      {run.error && run.error.trim() ? (
        <p className="mt-2 text-xs leading-5 text-red-600 dark:text-red-400">{run.error.trim()}</p>
      ) : null}

      {resultHref ? (
        <div className="mt-3">
          <Link href={resultHref} className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300">
            Open conversation →
          </Link>
        </div>
      ) : null}
    </li>
  );
}

function SourceBadge({ source }: { source: AgentRun["source"] }) {
  const map: Record<AgentRun["source"], { label: string; icon: typeof Globe }> = {
    web: { label: "Chat", icon: MessageSquare },
    telegram: { label: "Telegram", icon: Send },
    scheduled: { label: "Scheduled", icon: CalendarClock },
  };
  const entry = map[source] ?? { label: source, icon: Globe };
  const Icon = entry.icon;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {entry.label}
    </span>
  );
}

function StatusPill({
  status,
}: {
  status: { label: string; tone: "success" | "warning" | "error" | "running" };
}) {
  const config = {
    success: { icon: CheckCircle2, className: "text-teal-600 dark:text-teal-400" },
    warning: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
    error: { icon: XCircle, className: "text-red-500" },
    running: { icon: Clock, className: "text-amber-500 animate-pulse" },
  }[status.tone];
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-[11px] font-medium", config.className)}>
      <Icon className="h-3.5 w-3.5" />
      {status.label}
    </span>
  );
}

function formatRelativeTime(value: string): string {
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(secs < 10 ? 1 : 0)}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${Math.round(secs % 60)}s`;
}
