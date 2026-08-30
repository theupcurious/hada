"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WelcomeStatusLineProps {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function WelcomeStatusLine({ text, actionLabel, onAction, className }: WelcomeStatusLineProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5",
        className,
      )}
    >
      <p className="min-w-0 truncate text-sm text-zinc-500 dark:text-zinc-400">{text}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAction}
          aria-label={actionLabel}
          className="h-7 shrink-0 px-2.5 text-xs font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
