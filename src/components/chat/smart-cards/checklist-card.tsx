"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckSquare2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistCardGroup {
  name: string;
  items: string[];
}

export interface ChecklistCardProps {
  title: string;
  groups: ChecklistCardGroup[];
}

export function ChecklistCard({ title, groups }: ChecklistCardProps) {
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="my-3 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-950/45"
      aria-label={title}
    >
      <div className="border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <CheckSquare2 className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{title}</span>
          </div>
          <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
            {completedCount}/{totalItems}
          </span>
        </div>

        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] duration-200 dark:bg-teal-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2">
        {groups.map((group, groupIndex) => (
          <motion.article
            key={`${group.name}-${groupIndex}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: groupIndex * 0.04 }}
            className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/70 dark:bg-zinc-900/50"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              {group.name}
            </p>

            <div className="mt-3 space-y-2">
              {group.items.map((item) => {
                const key = `${group.name}:${item}`;
                const isChecked = checked.has(key);

                return (
                  <button
                    key={key}
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
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      isChecked
                        ? "bg-teal-50 text-teal-950 dark:bg-teal-950/25 dark:text-teal-50"
                        : "bg-zinc-50/80 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-950/35 dark:text-zinc-300 dark:hover:bg-zinc-900/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        isChecked
                          ? "border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-zinc-950"
                          : "border-zinc-300 dark:border-zinc-700",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className={cn("text-sm leading-relaxed", isChecked && "line-through opacity-75")}>
                      {item}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}
