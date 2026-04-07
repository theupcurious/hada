"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WelcomeStarterActions, type WelcomeStarterAction } from "@/components/chat/welcome-starter-actions";
import { WelcomeContinueRow, type WelcomeContinueRowProps } from "@/components/chat/welcome-continue-row";
import { WelcomeStatusLine, type WelcomeStatusLineProps } from "@/components/chat/welcome-status-line";

export interface WelcomeHomeProps {
  greeting: string;
  subtitle: string;
  starterActions: readonly WelcomeStarterAction[];
  continueRow: WelcomeContinueRowProps;
  statusLine: WelcomeStatusLineProps;
  className?: string;
}

export function WelcomeHome({
  greeting,
  subtitle,
  starterActions,
  continueRow,
  statusLine,
  className,
}: WelcomeHomeProps) {
  const titleId = "welcome-home-title";
  const subtitleId = "welcome-home-subtitle";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      className={cn(
        "relative w-full overflow-hidden rounded-[2rem] border border-border/60 bg-background/80 px-5 py-10 shadow-sm backdrop-blur-sm sm:px-7 sm:py-14",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-teal-400/60 before:to-transparent",
        "dark:bg-zinc-950/40",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.14),transparent_55%)]" />

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">
            Hada
          </p>
          <h1
            id={titleId}
            className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50"
          >
            {greeting}
          </h1>
          <p
            id={subtitleId}
            className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500 sm:text-base dark:text-zinc-400"
          >
            {subtitle}
          </p>
        </div>

        {starterActions.length > 0 ? (
          <div className="mt-10 w-full max-w-4xl sm:mt-12">
            <WelcomeStarterActions actions={starterActions} />
          </div>
        ) : null}

        <div className="mt-8 w-full max-w-3xl sm:mt-10">
          <WelcomeContinueRow {...continueRow} />
        </div>

        <div className="mt-6 w-full max-w-3xl sm:mt-7">
          <WelcomeStatusLine {...statusLine} />
        </div>
      </div>
    </motion.section>
  );
}
