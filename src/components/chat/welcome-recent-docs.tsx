"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WelcomeRecentDocItem {
  id: string;
  title: string;
  meta?: string;
  onOpen: () => void;
}

export interface WelcomeRecentDocsProps {
  heading: string;
  items: readonly WelcomeRecentDocItem[];
  actionLabel: string;
  onViewAll: () => void;
  className?: string;
}

/** Up to a few recent doc titles — real content in the space a bare count used to take. */
export function WelcomeRecentDocs({ heading, items, actionLabel, onViewAll, className }: WelcomeRecentDocsProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-3 px-1 py-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{heading}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onViewAll}
          aria-label={actionLabel}
          className="h-7 shrink-0 px-2.5 text-xs font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
        >
          {actionLabel}
        </Button>
      </div>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onOpen}
              className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-600 dark:text-zinc-300">{item.title}</span>
              {item.meta ? (
                <span className="hidden shrink-0 text-xs text-zinc-400 dark:text-zinc-500 sm:block">{item.meta}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
