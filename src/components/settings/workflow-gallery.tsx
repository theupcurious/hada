"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Clock3, Globe2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_TEMPLATES,
  WORKFLOW_FREQUENCY_LABELS,
  localScheduleToCron,
  type WorkflowFrequency,
  type WorkflowTemplate,
} from "@/lib/workflows/templates";
import {
  formatNextRunExact,
  getTimeZoneLabel,
  getUserTimeZone,
  nextRunFromCron,
} from "@/lib/workflows/schedule";

interface SpaceOption {
  id: string;
  name: string;
  emoji: string | null;
}

export interface WorkflowGalleryProps {
  onCreated: () => void;
}

const FREQUENCIES: WorkflowFrequency[] = ["daily", "weekdays", "weekly_monday"];

/** "08:00" → "8:00 AM" in the viewer's locale. */
function formatTimeOfDay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function WorkflowGallery({ onCreated }: WorkflowGalleryProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<WorkflowFrequency>("weekdays");
  const [time, setTime] = useState("08:00");
  const [details, setDetails] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);

  const timeZone = useMemo(() => getUserTimeZone(), []);
  const timeZoneLabel = useMemo(() => getTimeZoneLabel(timeZone), [timeZone]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/integrations/google")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { connected?: boolean } | null) => {
        if (!cancelled) setGoogleConnected(Boolean(data?.connected));
      })
      .catch(() => {
        if (!cancelled) setGoogleConnected(null);
      });
    void fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { projects?: SpaceOption[] } | null) => {
        if (!cancelled && data?.projects) setSpaces(data.projects);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTemplate = useMemo(
    () => WORKFLOW_TEMPLATES.find((t) => t.id === activeId) ?? null,
    [activeId],
  );

  // Prioritize templates that work with the current connections: those needing a
  // disconnected integration sink to the bottom.
  const orderedTemplates = useMemo(() => {
    return [...WORKFLOW_TEMPLATES].sort((a, b) => {
      const aBlocked = a.requiresIntegration === "google" && googleConnected === false ? 1 : 0;
      const bBlocked = b.requiresIntegration === "google" && googleConnected === false ? 1 : 0;
      return aBlocked - bBlocked;
    });
  }, [googleConnected]);

  const previewCron = useMemo(
    () => localScheduleToCron(frequency, time, new Date().getTimezoneOffset()),
    [frequency, time],
  );
  const nextRun = useMemo(() => nextRunFromCron(previewCron), [previewCron]);

  const openTemplate = (template: WorkflowTemplate) => {
    setActiveId(template.id);
    setFrequency(template.defaultFrequency);
    setTime(template.defaultTime);
    setDetails("");
    setProjectId("");
    setError(null);
  };

  const closeConfig = () => {
    setActiveId(null);
    setError(null);
  };

  const createWorkflow = async () => {
    if (!activeTemplate) return;
    setSubmitting(true);
    setError(null);
    try {
      const cron = localScheduleToCron(frequency, time, new Date().getTimezoneOffset());
      const prompt = details.trim()
        ? `${activeTemplate.prompt}\n\nAdditional focus from me: ${details.trim()}`
        : activeTemplate.prompt;
      const response = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "recurring",
          description: prompt,
          cron_expression: cron,
          ...(projectId ? { project_id: projectId } : {}),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Failed (${response.status})`);
      }
      closeConfig();
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workflow");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {orderedTemplates.map((template) => {
          const needsGoogle = template.requiresIntegration === "google";
          const disconnected = needsGoogle && googleConnected === false;
          const isActive = template.id === activeId;
          return (
            <div key={template.id} className="space-y-0">
              <button
                type="button"
                onClick={() => (isActive ? closeConfig() : openTemplate(template))}
                aria-expanded={isActive}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                  isActive
                    ? "border-teal-500/50 bg-teal-500/5"
                    : "border-zinc-200 bg-white/80 hover:border-teal-500/40 hover:bg-teal-500/5 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:bg-teal-500/10",
                )}
              >
                <span aria-hidden className="text-xl leading-none">
                  {template.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {template.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {template.summary}
                  </span>
                  {disconnected ? (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Needs Google
                      <Link
                        href="/settings?tab=integrations"
                        onClick={(e) => e.stopPropagation()}
                        className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        Connect
                      </Link>
                    </span>
                  ) : null}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isActive ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          Frequency
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
                          Time
                          <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="mt-1 block h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          />
                        </label>
                      </div>

                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        Topic or focus (optional)
                        <textarea
                          value={details}
                          onChange={(e) => setDetails(e.target.value)}
                          rows={2}
                          placeholder="Anything specific this should focus on — e.g. a topic, project, or people."
                          className="mt-1 block w-full resize-none rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </label>

                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        Space
                        <select
                          value={projectId}
                          onChange={(e) => setProjectId(e.target.value)}
                          className="mt-1 block h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          <option value="">General</option>
                          {spaces.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.emoji?.trim() ? `${s.emoji} ` : ""}
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Review: schedule, exact next run, timezone, delivery. */}
                      <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-white/70 px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
                        <p className="flex items-center gap-2">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                          {WORKFLOW_FREQUENCY_LABELS[frequency]} at {formatTimeOfDay(time)}
                        </p>
                        {nextRun ? (
                          <p className="flex items-center gap-2">
                            <Clock3 className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                            Next run: {formatNextRunExact(nextRun, timeZone)}
                          </p>
                        ) : null}
                        <p className="flex items-center gap-2">
                          <Globe2 className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                          Timezone: {timeZoneLabel}
                        </p>
                        <p className="flex items-center gap-2">
                          <Send className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                          Delivered to your Hada chat{" "}
                          <span className="text-zinc-400">· also sent to Telegram when connected</span>
                        </p>
                      </div>

                      <details className="text-xs text-zinc-500 dark:text-zinc-400">
                        <summary className="cursor-pointer select-none">Advanced: cron schedule</summary>
                        <code className="mt-1.5 block rounded bg-zinc-100 px-2 py-1 text-[11px] dark:bg-zinc-800">
                          {previewCron} <span className="text-zinc-400">(UTC)</span>
                        </code>
                      </details>

                      {error ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                      ) : null}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="brand"
                          className="rounded-full"
                          onClick={() => void createWorkflow()}
                          disabled={submitting}
                        >
                          {submitting ? "Creating…" : "Create workflow"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={closeConfig}
                          disabled={submitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
