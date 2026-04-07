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
        "flex w-full flex-col gap-3 rounded-2xl border border-border/60 bg-background px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        "dark:bg-zinc-900/60",
        className,
      )}
    >
      <p className="min-w-0 truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{text}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAction}
          aria-label={actionLabel}
          className="shrink-0 rounded-full"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
