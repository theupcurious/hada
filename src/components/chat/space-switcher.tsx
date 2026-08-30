"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";

export interface Space {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
  /** Optional space context, carried for the chat home hero (unused by the switcher UI). */
  description?: string | null;
  /** Starter prompts prefilled from the space's template, for the empty-state cards. */
  suggestions?: string[] | null;
}

interface SpaceSwitcherProps {
  spaces: Space[];
  /** null = the default "General" space. */
  activeId: string | null;
  onSwitch: (space: Space | null) => void;
  generalLabel: string;
  newSpaceHref: string;
  newSpaceLabel: string;
  switchAria: string;
}

/**
 * Deterministic accent hue per space, derived from its id — gives each space a
 * stable colored dot for at-a-glance recognition without any schema change.
 * (A real per-space emoji/color lives with the persona slice later.)
 */
function spaceHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/**
 * A space's visual identity: its emoji if set, otherwise a colored dot using
 * its stored accent color, falling back to a stable hashed hue. `space === null`
 * is the default General space (a neutral dot).
 */
function SpaceIdentity({ space }: { space: Space | null }) {
  if (space === null) {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />;
  }
  if (space.emoji) {
    return (
      <span className="w-4 shrink-0 text-center text-[13px] leading-none" aria-hidden>
        {space.emoji}
      </span>
    );
  }
  const background = space.color || `hsl(${spaceHue(space.id)} 62% 50%)`;
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: background }} />;
}

export function SpaceSwitcher({
  spaces,
  activeId,
  onSwitch,
  generalLabel,
  newSpaceHref,
  newSpaceLabel,
  switchAria,
}: SpaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSpace = activeId === null ? null : spaces.find((s) => s.id === activeId) ?? null;
  const activeName = activeSpace?.name ?? generalLabel;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (space: Space | null) => {
    setOpen(false);
    if ((space?.id ?? null) !== activeId) {
      onSwitch(space);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={switchAria}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[9rem] items-center gap-1.5 rounded-full border border-zinc-200/80 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800/60 sm:max-w-[12rem] sm:text-sm"
      >
        <SpaceIdentity space={activeSpace} />
        <span className="truncate">{activeName}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lg shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={activeId === null}
            onClick={() => select(null)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
          >
            <SpaceIdentity space={null} />
            <span className="min-w-0 flex-1 truncate">{generalLabel}</span>
            {activeId === null ? <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" /> : null}
          </button>

          {spaces.map((space) => (
            <button
              key={space.id}
              type="button"
              role="menuitemradio"
              aria-checked={activeId === space.id}
              onClick={() => select(space)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
            >
              <SpaceIdentity space={space} />
              <span className="min-w-0 flex-1 truncate">{space.name}</span>
              {activeId === space.id ? (
                <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
              ) : null}
            </button>
          ))}

          <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />

          <Link
            href={newSpaceHref}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-200"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">{newSpaceLabel}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
