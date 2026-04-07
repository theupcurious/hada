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
        "flex w-full flex-row items-center justify-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400",
        className,
      )}
    >
      <p className="truncate">{text}</p>
      {actionLabel && onAction ? (
        <>
          <span aria-hidden="true" className="shrink-0 opacity-40">·</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAction}
            aria-label={actionLabel}
            className="h-auto shrink-0 rounded-full px-0 py-0 text-xs text-teal-600 hover:bg-transparent hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
          >
            {actionLabel}
          </Button>
        </>
      ) : null}
    </div>
  );
}
