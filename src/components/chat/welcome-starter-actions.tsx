"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export interface WelcomeStarterAction {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  onClick: () => void;
  onDismiss?: () => void;
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
    <div className={cn("grid w-full gap-2 md:grid-cols-3 md:gap-3", className)}>
      {actions.map((action) => (
        <div
          key={action.id}
          className={cn(
            "relative rounded-2xl border border-border/70 bg-background/75 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-500/40 hover:bg-teal-500/5 hover:shadow-md hover:shadow-teal-500/10",
            "dark:bg-zinc-950/50 dark:hover:bg-teal-500/10",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={action.onClick}
            disabled={action.disabled}
            aria-label={action.label}
            className="flex h-full min-h-24 w-full justify-start whitespace-normal rounded-2xl px-4 py-3 text-left hover:bg-transparent"
          >
            <span className="flex w-full items-start gap-3 pr-8">
              {action.icon ? (
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300"
                >
                  {action.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-medium leading-5 text-zinc-950 dark:text-zinc-50">
                  {action.label}
                </span>
                {action.description ? (
                  <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {action.description}
                  </span>
                ) : null}
              </span>
            </span>
          </Button>
          {action.onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={action.onDismiss}
              aria-label={`Dismiss ${action.label}`}
              className="absolute right-2 top-2 z-10 size-7 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
