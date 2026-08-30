"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WelcomeContinueRowProps {
  label: string;
  onContinue: () => void;
  description?: string;
  actionLabel?: string;
  className?: string;
}

export function WelcomeContinueRow({
  label,
  onContinue,
  description,
  actionLabel = "Continue",
  className,
}: WelcomeContinueRowProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">{label}</p>
        {description ? (
          <p className="hidden shrink-0 text-xs text-zinc-400 dark:text-zinc-500 sm:block">
            {description}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onContinue}
        aria-label={`${actionLabel}: ${label}`}
        className="h-7 shrink-0 px-2.5 text-xs font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
