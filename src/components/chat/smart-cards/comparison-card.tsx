"use client";

import { motion } from "framer-motion";
import { CheckCircle2, GitCompareArrows, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComparisonCardItem {
  name: string;
  subtitle?: string;
  scores?: Record<string, number>;
  pros?: string[];
  cons?: string[];
}

export interface ComparisonCardProps {
  title: string;
  items: ComparisonCardItem[];
  verdict?: string;
}

export function ComparisonCard({ title, items, verdict }: ComparisonCardProps) {
  if (items.length < 2) {
    return null;
  }

  const scoreKeys = Array.from(
    new Set(items.flatMap((item) => Object.keys(item.scores || {}))),
  );
  const itemTotals = items.map((item) => {
    const values = Object.values(item.scores || {});
    const average = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
    return average;
  });
  const bestAverage = itemTotals.reduce<number | null>(
    (best, value) => (value != null && (best == null || value > best) ? value : best),
    null,
  );

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
            <GitCompareArrows className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title}</span>
        </div>
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
          {items.length} options
        </span>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2">
        {items.map((item, index) => {
          const average = itemTotals[index];
          const isLeader = average != null && bestAverage != null && average === bestAverage;

          return (
            <motion.article
              key={`${item.name}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.04, ease: "easeOut" }}
              className={cn(
                "rounded-2xl border px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]",
                isLeader
                  ? "border-teal-300/80 bg-teal-50/80 dark:border-teal-800/70 dark:bg-teal-950/20"
                  : "border-zinc-200/70 bg-white/70 dark:border-zinc-800/70 dark:bg-zinc-900/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    {item.name}
                  </p>
                  {item.subtitle ? (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.subtitle}</p>
                  ) : null}
                </div>
                {isLeader ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                    <Trophy className="h-3 w-3" />
                    Winner
                  </span>
                ) : null}
              </div>

              {scoreKeys.length ? (
                <div className="mt-4 space-y-2">
                  {scoreKeys.map((key) => {
                    const value = item.scores?.[key];
                    if (value == null) {
                      return null;
                    }

                    return (
                      <div key={key} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">{key}</span>
                        <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
                          {value}/5
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {item.pros?.length ? (
                  <div className="rounded-xl bg-white/75 p-3 dark:bg-zinc-950/35">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pros
                    </p>
                    <ul className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                      {item.pros.map((pro) => (
                        <li key={pro} className="leading-relaxed">
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {item.cons?.length ? (
                  <div className="rounded-xl bg-white/75 p-3 dark:bg-zinc-950/35">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-400">
                      <XCircle className="h-3.5 w-3.5" />
                      Cons
                    </p>
                    <ul className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                      {item.cons.map((con) => (
                        <li key={con} className="leading-relaxed">
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </motion.article>
          );
        })}
      </div>

      {verdict ? (
        <div className="border-t border-zinc-200/70 bg-zinc-50/70 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:text-zinc-300">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Verdict:</span> {verdict}
        </div>
      ) : null}
    </motion.section>
  );
}
