"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { History, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SegmentListItem } from "@/lib/db/segments";

export interface HistoryPanelCopy {
  title: string;
  searchPlaceholder: string;
  loading: string;
  empty: string;
  noMatches: string;
  current: string;
  messageCountSuffix: string;
  closeAria: string;
  untitled: string;
}

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  segments: SegmentListItem[];
  loading: boolean;
  activeSegmentId: string | null;
  onSelect: (segment: SegmentListItem) => void;
  copy: HistoryPanelCopy;
  localeTag: string;
}

export function HistoryPanel({
  open,
  onClose,
  segments,
  loading,
  activeSegmentId,
  onSelect,
  copy,
  localeTag,
}: HistoryPanelProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      setQuery("");
      searchRef.current?.focus();
    });
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        month: "short",
        day: "numeric",
      }),
    [localeTag],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((segment) => {
      const haystack = [segment.title, segment.topic_key, segment.summary]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [segments, query]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            className="absolute inset-y-0 left-0 flex w-full max-w-sm flex-col border-r border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                <History className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                {copy.title}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={copy.closeAria}
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {loading ? (
                <p className="px-2 py-6 text-center text-sm text-zinc-400">{copy.loading}</p>
              ) : segments.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-zinc-400">{copy.empty}</p>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-zinc-400">{copy.noMatches}</p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((segment) => {
                    const isActive = segment.id === activeSegmentId;
                    const label = segment.title?.trim() || segment.topic_key?.trim() || copy.untitled;
                    return (
                      <li key={segment.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(segment)}
                          className={cn(
                            "w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                            isActive
                              ? "bg-teal-500/10 ring-1 ring-teal-500/30"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {label}
                            </span>
                            <span className="shrink-0 text-[11px] text-zinc-400">
                              {formatDate(dateFormatter, segment.last_active_at)}
                            </span>
                          </div>
                          {segment.summary?.trim() ? (
                            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                              {segment.summary}
                            </p>
                          ) : null}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] text-zinc-400">
                              {segment.message_count} {copy.messageCountSuffix}
                            </span>
                            {isActive ? (
                              <span className="rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-300">
                                {copy.current}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function formatDate(formatter: Intl.DateTimeFormat, value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return formatter.format(parsed);
}
