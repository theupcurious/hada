"use client";

import { motion } from "framer-motion";
import { CheckCircle2, GitCompareArrows, Trophy, XCircle, ArrowRight } from "lucide-react";
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
  onAction?: (message: string) => void;
}

const SCORE_COLORS = [
  { bar: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
  { bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  { bar: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-400" },
  { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
];

export function ComparisonCard({ title, items, verdict, onAction }: ComparisonCardProps) {
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="my-3 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/90 shadow-sm backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-900/70"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/50">
        <div className="flex min-w-0 items-center gap-2.5 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-sm">
            <GitCompareArrows className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title}</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05, ease: "easeOut" }}
              className={cn(
                "rounded-xl border px-4 py-4 transition-colors",
                isLeader
                  ? "border-amber-400/50 bg-amber-50/60 dark:border-amber-600/30 dark:bg-amber-950/15"
                  : "border-zinc-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/60",
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
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-sm shadow-amber-500/25">
                    <Trophy className="h-3 w-3" />
                    Best
                  </span>
                ) : null}
              </div>

              {scoreKeys.length ? (
                <div className="mt-4 space-y-2.5">
                  {scoreKeys.map((key, scoreIndex) => {
                    const value = item.scores?.[key];
                    if (value == null) {
                      return null;
                    }
                    const color = SCORE_COLORS[scoreIndex % SCORE_COLORS.length];

                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-zinc-500 dark:text-zinc-400">{key}</span>
                          <span className={cn("font-semibold tabular-nums", color.text)}>
                            {value}/5
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
                          <motion.div
                            className={cn("h-full rounded-full", color.bar)}
                            initial={{ width: 0 }}
                            animate={{ width: `${(value / 5) * 100}%` }}
                            transition={{ duration: 0.4, delay: index * 0.05 + scoreIndex * 0.06, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {onAction ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAction(`Tell me more about ${item.name}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    Tell me more
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction(`I'll go with ${item.name}. What should I do next?`)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                      isLeader
                        ? "text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                    )}
                  >
                    Choose this
                  </button>
                </div>
              ) : null}

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {item.pros?.length ? (
                  <div className="rounded-lg bg-emerald-50/80 p-3 dark:bg-emerald-950/20">
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
                  <div className="rounded-lg bg-rose-50/80 p-3 dark:bg-rose-950/20">
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
        <div className="border-t border-zinc-200/70 bg-gradient-to-r from-zinc-50/80 to-zinc-100/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800/50 dark:from-zinc-900/60 dark:to-zinc-900/40 dark:text-zinc-300">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Verdict:</span> {verdict}
        </div>
      ) : null}
    </motion.section>
  );
}
