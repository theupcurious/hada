"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Space } from "@/components/chat/space-switcher";

/**
 * A stable hue derived from a space id — the same fallback the top-bar
 * SpaceSwitcher uses, so a space's dot looks identical in both places when it
 * has no explicit accent color set.
 */
function spaceHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** A space's emoji if set, else its accent color (or a hashed-hue) dot. */
function Glyph({ space }: { space: Space | null }) {
  if (space?.emoji?.trim()) {
    return (
      <span className="text-base leading-none" aria-hidden>
        {space.emoji}
      </span>
    );
  }
  const background = space ? space.color || `hsl(${spaceHue(space.id)} 62% 50%)` : undefined;
  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", !space && "bg-zinc-300 dark:bg-zinc-600")}
      style={background ? { backgroundColor: background } : undefined}
      aria-hidden
    />
  );
}

export interface SpacesRailProps {
  spaces: readonly Space[];
  activeId: string | null;
  /** null selects the default General space. */
  onSelect: (space: Space | null) => void;
  generalLabel: string;
  heading: string;
  newSpaceLabel: string;
  newSpaceHref: string;
}

/**
 * Persistent desktop rail listing General + every space, so switching context is
 * always one click away and the Spaces feature stays visible instead of hiding
 * behind the top-bar switcher. Hidden below `md` (the header switcher and the
 * home "Your Spaces" strip cover small screens); the caller hides it entirely
 * when an artifact panel is open to preserve reading width.
 */
export function SpacesRail({
  spaces,
  activeId,
  onSelect,
  generalLabel,
  heading,
  newSpaceLabel,
  newSpaceHref,
}: SpacesRailProps) {
  const rowFor = (active: boolean) =>
    cn(
      "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
      active
        ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-100"
        : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100",
    );

  return (
    <aside
      aria-label={heading}
      className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200/80 bg-white/50 px-2.5 py-4 dark:border-zinc-800/60 dark:bg-zinc-950/30 md:flex"
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={activeId === null ? "page" : undefined}
        className={rowFor(activeId === null)}
      >
        <Glyph space={null} />
        <span className="min-w-0 flex-1 truncate">{generalLabel}</span>
      </button>

      <p className="mb-1 mt-4 px-2.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        {heading}
      </p>

      <nav className="flex flex-col gap-0.5">
        {spaces.map((space) => {
          const active = space.id === activeId;
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => onSelect(space)}
              aria-current={active ? "page" : undefined}
              className={rowFor(active)}
            >
              <Glyph space={space} />
              <span className="min-w-0 flex-1 truncate">{space.name}</span>
            </button>
          );
        })}
      </nav>

      <Link
        href={newSpaceHref}
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{newSpaceLabel}</span>
      </Link>
    </aside>
  );
}
