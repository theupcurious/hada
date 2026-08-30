"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WelcomeSpaceItem {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
}

export interface WelcomeSpacesStripProps {
  heading: string;
  newLabel: string;
  spaces: readonly WelcomeSpaceItem[];
  onOpen: (id: string) => void;
  onNew: () => void;
  className?: string;
}

/** Fallback accent color when a space has none set. */
const DEFAULT_ACCENT = "#14b8a6";

function SpaceGlyph({ emoji, color }: { emoji?: string | null; color?: string | null }) {
  if (emoji?.trim()) {
    return (
      <span className="text-base leading-none" aria-hidden>
        {emoji}
      </span>
    );
  }
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color || DEFAULT_ACCENT }}
      aria-hidden
    />
  );
}

/**
 * A compact "Your Spaces" strip for the chat home (General view only). Surfaces
 * each space by its persona (emoji or accent dot) so the identity work is
 * discoverable without opening the switcher, plus a tile to create a new one.
 */
export function WelcomeSpacesStrip({
  heading,
  newLabel,
  spaces,
  onOpen,
  onNew,
  className,
}: WelcomeSpacesStripProps) {
  return (
    <section className={cn("w-full text-left", className)} aria-label={heading}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        {heading}
      </p>
      <div className="flex flex-wrap gap-2">
        {spaces.map((space) => (
          <button
            key={space.id}
            type="button"
            onClick={() => onOpen(space.id)}
            className="group flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <SpaceGlyph emoji={space.emoji} color={space.color} />
            <span className="max-w-[12rem] truncate">{space.name}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 bg-transparent px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{newLabel}</span>
        </button>
      </div>
    </section>
  );
}
