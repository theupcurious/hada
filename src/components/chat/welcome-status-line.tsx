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
        "flex w-full flex-col gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="min-w-0 truncate">{text}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAction}
          aria-label={actionLabel}
          className="-mr-2 h-7 rounded-full px-2.5 text-xs"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
