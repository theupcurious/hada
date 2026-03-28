"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ListOrdered, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepsCardStep {
  title: string;
  detail?: string;
  time?: string;
}

export interface StepsCardProps {
  title: string;
  steps: StepsCardStep[];
  onAction?: (message: string) => void;
}

const STEP_COLORS = [
  { bg: "bg-violet-500", text: "text-violet-500", border: "border-violet-500/30", glow: "shadow-violet-500/20" },
  { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500/30", glow: "shadow-blue-500/20" },
  { bg: "bg-cyan-500", text: "text-cyan-500", border: "border-cyan-500/30", glow: "shadow-cyan-500/20" },
  { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" },
  { bg: "bg-amber-500", text: "text-amber-500", border: "border-amber-500/30", glow: "shadow-amber-500/20" },
  { bg: "bg-rose-500", text: "text-rose-500", border: "border-rose-500/30", glow: "shadow-rose-500/20" },
  { bg: "bg-indigo-500", text: "text-indigo-500", border: "border-indigo-500/30", glow: "shadow-indigo-500/20" },
  { bg: "bg-pink-500", text: "text-pink-500", border: "border-pink-500/30", glow: "shadow-pink-500/20" },
];

export function StepsCard({ title, steps, onAction }: StepsCardProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(() =>
    new Set(steps.findIndex((step) => Boolean(step.detail)) >= 0 ? [steps.findIndex((step) => Boolean(step.detail))] : []),
  );

  if (!steps.length) {
    return null;
  }

  const completedCount = completed.size;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="my-3 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/90 shadow-sm backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-900/70"
      aria-label={title}
    >
      <div className="border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-sm">
              <ListOrdered className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{title}</span>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
            {completedCount}/{steps.length} done
          </span>
        </div>

        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="relative space-y-2.5 p-3 sm:p-4">
        {/* Vertical connecting line */}
        <div className="absolute bottom-6 left-[1.85rem] top-6 w-px bg-gradient-to-b from-violet-500/20 via-blue-500/20 to-emerald-500/20 sm:left-[2.1rem]" />

        {steps.map((step, index) => {
          const isDone = completed.has(index);
          const isExpanded = expanded.has(index);
          const hasDetail = Boolean(step.detail);
          const color = STEP_COLORS[index % STEP_COLORS.length];

          return (
            <motion.article
              key={`${step.title}-${index}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className={cn(
                "relative rounded-xl border px-4 py-3 transition-colors",
                isDone
                  ? "border-teal-400/40 bg-teal-50/80 dark:border-teal-700/40 dark:bg-teal-950/25"
                  : "border-zinc-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/60",
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
                    "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all",
                    isDone
                      ? "bg-teal-500 text-white shadow-sm shadow-teal-500/30 dark:bg-teal-400 dark:text-zinc-950 dark:shadow-teal-400/20"
                      : cn(color.bg, "text-white shadow-sm", color.glow),
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.18em]",
                        isDone
                          ? "text-teal-600 dark:text-teal-400"
                          : cn(color.text),
                      )}>
                        Step {index + 1}
                      </p>
                      <p className={cn("mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100", isDone && "line-through opacity-60")}>
                        {step.title}
                      </p>
                      {step.time ? (
                        <p className="mt-1.5 inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{step.time}</p>
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
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
                        <p className="mt-3 border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                          {step.detail}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {onAction ? (
                    <button
                      type="button"
                      onClick={() => onAction(`Tell me more about step ${index + 1}: ${step.title}`)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      Dive deeper
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.section>
  );
}
