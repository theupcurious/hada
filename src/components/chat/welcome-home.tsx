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
      className={cn("w-full px-5 py-10 sm:px-7 sm:py-14", className)}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <div>
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
            className="mx-auto mt-3 text-sm leading-6 text-zinc-500 sm:text-base dark:text-zinc-400"
          >
            {subtitle}
          </p>
        </div>

        {starterActions.length > 0 ? (
          <div className="mt-10 w-full sm:mt-12">
            <WelcomeStarterActions actions={starterActions} />
          </div>
        ) : null}

        <div className="mt-4 w-full sm:mt-5">
          <WelcomeContinueRow {...continueRow} />
        </div>

        <div className="mt-5 w-full sm:mt-6">
          <WelcomeStatusLine {...statusLine} />
        </div>
      </div>
    </motion.section>
  );
}
