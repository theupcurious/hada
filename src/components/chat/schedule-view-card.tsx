"use client";

import { motion } from "framer-motion";
import { Calendar, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleBlock } from "@/lib/types/cards";

export interface ScheduleViewCardProps {
  title: string;
  timeframe: string;
  blocks: ScheduleBlock[];
}

const blockStyles = {
  event: {
    container:
      "border-teal-200 bg-teal-50/80 text-teal-950 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-50",
    dot: "bg-teal-500",
    accent: "text-teal-600 dark:text-teal-400",
    icon: null,
  },
  suggestion: {
    container:
      "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-50",
    dot: "bg-amber-500",
    accent: "text-amber-600 dark:text-amber-400",
    icon: Sparkles,
  },
  free: {
    container:
      "border-zinc-200 bg-white/80 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-50",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    accent: "text-zinc-500 dark:text-zinc-400",
    icon: null,
  },
} as const;

export function ScheduleViewCard({ title, timeframe, blocks }: ScheduleViewCardProps) {
  if (!blocks.length) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="my-3 overflow-hidden rounded-xl border border-zinc-200/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{title}</span>
        </div>
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{timeframe}</span>
      </div>

      <div className="px-4 py-4">
        <div className="relative space-y-2">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-200 dark:bg-zinc-800" />

          {blocks.map((block, index) => {
            const style = blockStyles[block.type] ?? blockStyles.free;
            const Icon = style.icon;

            return (
              <motion.div
                key={`${block.time}-${block.title}-${index}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.16, delay: index * 0.03 }}
                className="relative flex items-start gap-3 pl-5"
              >
                <div
                  className={cn(
                    "absolute left-[2px] top-3 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-900",
                    style.dot,
                  )}
                />

                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-lg border px-3 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.02)]",
                    style.container,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {Icon ? <Icon className={cn("h-3.5 w-3.5 shrink-0", style.accent)} /> : null}
                        <p className="truncate text-sm font-semibold">{block.title}</p>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={cn("inline-flex items-center gap-1", style.accent)}>
                          <Clock className="h-3 w-3" />
                          <span>{block.time}</span>
                        </span>
                        {block.duration ? (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-white/10 dark:text-zinc-300">
                            {block.duration}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]",
                        block.type === "event" &&
                          "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
                        block.type === "suggestion" &&
                          "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        block.type === "free" &&
                          "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                      )}
                    >
                      {block.type}
                    </span>
                  </div>

                  {block.source ? (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {block.source}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
