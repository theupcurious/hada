"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckSquare2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistCardGroup {
  name: string;
  items: string[];
}

export interface ChecklistCardProps {
  title: string;
  groups: ChecklistCardGroup[];
  onAction?: (message: string) => void;
}

const GROUP_ACCENTS = [
  { dot: "bg-violet-500", label: "text-violet-600 dark:text-violet-400" },
  { dot: "bg-blue-500", label: "text-blue-600 dark:text-blue-400" },
  { dot: "bg-cyan-500", label: "text-cyan-600 dark:text-cyan-400" },
  { dot: "bg-emerald-500", label: "text-emerald-600 dark:text-emerald-400" },
  { dot: "bg-amber-500", label: "text-amber-600 dark:text-amber-400" },
  { dot: "bg-rose-500", label: "text-rose-600 dark:text-rose-400" },
];

export function ChecklistCard({ title, groups, onAction }: ChecklistCardProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const flatItems = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => `${group.name}:${item}`)),
    [groups],
  );
  const totalItems = flatItems.length;
  const completedCount = flatItems.filter((key) => checked.has(key)).length;
  const progress = totalItems ? Math.round((completedCount / totalItems) * 100) : 0;

  if (!groups.length) {
    return null;
  }

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
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
              <CheckSquare2 className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{title}</span>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
            {completedCount}/{totalItems}
          </span>
        </div>

        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2">
        {groups.map((group, groupIndex) => {
          const accent = GROUP_ACCENTS[groupIndex % GROUP_ACCENTS.length];

          return (
            <motion.article
              key={`${group.name}-${groupIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: groupIndex * 0.05 }}
              className="rounded-xl border border-zinc-200/60 bg-white p-4 dark:border-zinc-800/60 dark:bg-zinc-900/60"
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", accent.dot)} />
                <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", accent.label)}>
                  {group.name}
                </p>
              </div>

              <div className="mt-3 space-y-1.5">
                {group.items.map((item) => {
                  const key = `${group.name}:${item}`;
                  const isChecked = checked.has(key);

                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all",
                        isChecked
                          ? "bg-teal-50 dark:bg-teal-950/30"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setChecked((current) => {
                            const next = new Set(current);
                            if (next.has(key)) {
                              next.delete(key);
                            } else {
                              next.add(key);
                            }
                            return next;
                          });
                        }}
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                          isChecked
                            ? "border-teal-500 bg-teal-500 text-white shadow-sm shadow-teal-500/25 dark:border-teal-400 dark:bg-teal-400 dark:text-zinc-950"
                            : "border-zinc-300 text-transparent dark:border-zinc-600",
                        )}
                        aria-label={isChecked ? `Uncheck ${item}` : `Check ${item}`}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <span className={cn(
                        "flex-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300",
                        isChecked && "line-through opacity-60",
                      )}>
                        {item}
                      </span>
                      {onAction ? (
                        <button
                          type="button"
                          onClick={() => onAction(`Help me with: ${item}`)}
                          className="shrink-0 rounded-md p-1 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                          aria-label={`Ask about ${item}`}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.section>
  );
}
