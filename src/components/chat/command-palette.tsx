"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  /** Extra text to match against (not shown). */
  keywords?: string;
  /** Small leading glyph — emoji, colored dot, or icon. */
  glyph?: ReactNode;
  /** Group heading this item sits under. */
  group: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
  placeholder: string;
  items: readonly CommandItem[];
}

/**
 * A ⌘K command palette: type to filter, arrow keys to move, Enter to run,
 * Esc / click-outside to dismiss. Items are grouped by their `group`, in the
 * order they first appear. Mounted only while open (fresh state each time),
 * so it needs no reset effect. Dependency-free by design — mirrors the app's
 * hand-rolled popover pattern.
 */
export function CommandPalette({ onClose, placeholder, items }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      (it.label + " " + (it.keywords ?? "")).toLowerCase().includes(q),
    );
  }, [items, query]);

  // Clamp at use so the highlight stays valid without a state-syncing effect.
  const activeIdx = filtered.length === 0 ? -1 : Math.min(active, filtered.length - 1);

  // Focus the field on mount (DOM sync, not state) and keep the row in view.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const run = (idx: number) => {
    const item = filtered[idx];
    if (!item) return;
    onClose();
    item.onSelect();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(activeIdx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Group the filtered items, preserving first-seen group order.
  const groups: { name: string; items: { item: CommandItem; idx: number }[] }[] = [];
  filtered.forEach((item, idx) => {
    let g = groups.find((x) => x.name === item.group);
    if (!g) {
      g = { name: item.group, items: [] };
      groups.push(g);
    }
    g.items.push({ item, idx });
  });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={placeholder}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-popover shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-spring"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full border-b border-border/70 bg-transparent px-4 py-4 text-base text-foreground outline-none placeholder:text-zinc-400"
        />
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-400">No matches</p>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-1 pt-2 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  {g.name}
                </p>
                {g.items.map(({ item, idx }) => (
                  <button
                    key={item.id}
                    type="button"
                    data-idx={idx}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => run(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors",
                      idx === activeIdx
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-100"
                        : "text-zinc-600 dark:text-zinc-300",
                    )}
                  >
                    <span className="flex w-5 shrink-0 items-center justify-center text-[15px]">
                      {item.glyph}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {idx === activeIdx ? (
                      <span className="shrink-0 text-[11px] text-zinc-400">↵</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
