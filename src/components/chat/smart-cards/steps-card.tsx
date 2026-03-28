"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepsCardStep {
  title: string;
  detail?: string;
  time?: string;
}

export interface StepsCardProps {
  title: string;
  steps: StepsCardStep[];
}

export function StepsCard({ title, steps }: StepsCardProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(() =>
    new Set(steps.findIndex((step) => Boolean(step.detail)) >= 0 ? [steps.findIndex((step) => Boolean(step.detail))] : []),
  );

  if (!steps.length) {
    return null;
  }

  const completedCount = completed.size;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="my-3 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-950/45"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <ListOrdered className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title}</span>
        </div>
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
          {completedCount}/{steps.length} done
        </span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        {steps.map((step, index) => {
          const isDone = completed.has(index);
          const isExpanded = expanded.has(index);
          const hasDetail = Boolean(step.detail);

          return (
            <motion.article
              key={`${step.title}-${index}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16, delay: index * 0.03 }}
              className={cn(
                "rounded-2xl border px-4 py-3",
                isDone
                  ? "border-teal-300/80 bg-teal-50/80 dark:border-teal-800/70 dark:bg-teal-950/20"
                  : "border-zinc-200/70 bg-white/70 dark:border-zinc-800/70 dark:bg-zinc-900/50",
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-label={isDone ? `Mark ${step.title} incomplete` : `Mark ${step.title} complete`}
                  onClick={() => {
                    setCompleted((current) => {
                      const next = new Set(current);
                      if (next.has(index)) {
                        next.delete(index);
                      } else {
                        next.add(index);
                      }
                      return next;
                    });
                  }}
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isDone
                      ? "border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-zinc-950"
                      : "border-zinc-300 text-transparent hover:border-zinc-400 dark:border-zinc-700",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                        Step {index + 1}
                      </p>
                      <p className={cn("mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50", isDone && "line-through opacity-70")}>
                        {step.title}
                      </p>
                      {step.time ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{step.time}</p>
                      ) : null}
                    </div>

                    {hasDetail ? (
                      <button
                        type="button"
                        onClick={() => {
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(index)) {
                              next.delete(index);
                            } else {
                              next.add(index);
                            }
                            return next;
                          });
                        }}
                        className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        aria-label={isExpanded ? `Collapse ${step.title}` : `Expand ${step.title}`}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                    ) : null}
                  </div>

                  <AnimatePresence initial={false}>
                    {hasDetail && isExpanded ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {step.detail}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.section>
  );
}
