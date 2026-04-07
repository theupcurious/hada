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
        "flex w-full flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 px-5 py-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between",
        "dark:bg-zinc-950/45",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{label}</p>
        {description ? (
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onContinue}
        aria-label={`${actionLabel}: ${label}`}
        className="shrink-0 rounded-full"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
