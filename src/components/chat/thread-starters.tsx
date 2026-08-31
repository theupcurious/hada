"use client";

import { cn } from "@/lib/utils";
import type { WelcomeStarterAction } from "@/components/chat/welcome-starter-actions";

export interface ThreadStartersProps {
  actions: readonly WelcomeStarterAction[];
  className?: string;
}

/**
 * A compact, horizontally-scrollable row of the active Space's starter prompts,
 * shown just above the docked composer when the input is empty. It makes the
 * welcome screen's starters reachable from inside a thread — you never have to
 * go back to the home screen to start a fresh line of work in this Space.
 * Clicking a chip sends the prompt (same path as the empty-state cards).
 */
export function ThreadStarters({ actions, className }: ThreadStartersProps) {
  if (!actions.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "no-scrollbar flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-2",
        className,
      )}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="shrink-0 whitespace-nowrap rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:border-teal-500/40 hover:bg-teal-500/5 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
