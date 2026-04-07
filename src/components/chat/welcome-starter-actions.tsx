"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface WelcomeStarterAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface WelcomeStarterActionsProps {
  actions: readonly WelcomeStarterAction[];
  className?: string;
}

export function WelcomeStarterActions({ actions, className }: WelcomeStarterActionsProps) {
  if (!actions.length) {
    return null;
  }

  return (
    <div className={cn("grid w-full grid-cols-2 gap-3", className)}>
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant="ghost"
          onClick={action.onClick}
          disabled={action.disabled}
          aria-label={action.label}
          className={cn(
            "flex h-full min-h-20 w-full items-center justify-start gap-3 rounded-2xl border border-border/70 bg-background/75 px-4 py-4 shadow-sm backdrop-blur-sm",
            "transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-500/40 hover:bg-teal-500/5 hover:shadow-md hover:shadow-teal-500/10",
            "dark:bg-zinc-950/50 dark:hover:bg-teal-500/10",
          )}
        >
          {action.icon ? (
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300"
            >
              {action.icon}
            </span>
          ) : null}
          <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            {action.label}
          </span>
        </Button>
      ))}
    </div>
  );
}
