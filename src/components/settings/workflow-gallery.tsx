"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_TEMPLATES,
  WORKFLOW_FREQUENCY_LABELS,
  localScheduleToCron,
  type WorkflowFrequency,
  type WorkflowTemplate,
} from "@/lib/workflows/templates";

export interface WorkflowGalleryProps {
  onCreated: () => void;
}

const FREQUENCIES: WorkflowFrequency[] = ["daily", "weekdays", "weekly_monday"];

export function WorkflowGallery({ onCreated }: WorkflowGalleryProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<WorkflowFrequency>("weekdays");
  const [time, setTime] = useState("08:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTemplate = useMemo(
    () => WORKFLOW_TEMPLATES.find((t) => t.id === activeId) ?? null,
    [activeId],
  );

  const openTemplate = (template: WorkflowTemplate) => {
    setActiveId(template.id);
    setFrequency(template.defaultFrequency);
    setTime(template.defaultTime);
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
      const response = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "recurring",
          description: activeTemplate.prompt,
          cron_expression: cron,
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
        {WORKFLOW_TEMPLATES.map((template) => {
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
                    <span className="mt-1 inline-block text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Needs Google — connect in Integrations
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
