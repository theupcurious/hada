"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WelcomeStarterActions, type WelcomeStarterAction } from "@/components/chat/welcome-starter-actions";
import { WelcomeContinueRow, type WelcomeContinueRowProps } from "@/components/chat/welcome-continue-row";
import { WelcomeStatusLine, type WelcomeStatusLineProps } from "@/components/chat/welcome-status-line";

/** Visual identity of the active space, shown in the eyebrow when inside one. */
export interface WelcomeSpaceIdentity {
  name: string;
  emoji: string | null;
  color: string | null;
}

export interface WelcomeHomeProps {
  greeting: string;
  subtitle: string;
  starterActions: readonly WelcomeStarterAction[];
  continueRow: WelcomeContinueRowProps;
  statusLine: WelcomeStatusLineProps;
  /** When set, the eyebrow shows this space's identity instead of "Hada". */
  spaceIdentity?: WelcomeSpaceIdentity | null;
  /** Optional "Your Spaces" strip, rendered under the starter actions (General only). */
  spacesStrip?: ReactNode;
  className?: string;
}

const DEFAULT_ACCENT = "#14b8a6";

export function WelcomeHome({
  greeting,
  subtitle,
  starterActions,
  continueRow,
  statusLine,
  spaceIdentity,
  spacesStrip,
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
          {spaceIdentity ? (
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {spaceIdentity.emoji?.trim() ? (
                <span className="text-sm" aria-hidden>
                  {spaceIdentity.emoji}
                </span>
              ) : (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: spaceIdentity.color || DEFAULT_ACCENT }}
                  aria-hidden
                />
              )}
              <span className="normal-case tracking-normal">{spaceIdentity.name}</span>
            </p>
          ) : (
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">
              Hada
            </p>
          )}
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

        {/* Hidden at md+ where the persistent Spaces rail already lists spaces;
            shown on smaller screens as the only always-visible space launcher. */}
        {spacesStrip ? <div className="mt-5 w-full sm:mt-6 md:hidden">{spacesStrip}</div> : null}

        {/* Tertiary utilities — quiet rows, visually separated from the cards above. */}
        <div className="mt-6 w-full border-t border-zinc-200/70 pt-3 dark:border-zinc-800/70 sm:mt-8">
          <WelcomeContinueRow {...continueRow} />
          <WelcomeStatusLine {...statusLine} />
        </div>
      </div>
    </motion.section>
  );
}
