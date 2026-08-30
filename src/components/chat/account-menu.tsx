"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Moon, Settings2, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AccountMenuProps {
  name?: string | null;
  email?: string | null;
  accountAria: string;
  settingsLabel: string;
  signOutLabel: string;
  themeLabel: string;
  onSignOut: () => void;
}

/** Two-letter initials from a name (or the email local-part) for the avatar. */
function initials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.split("@")[0] || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/**
 * Account overflow menu — consolidates theme, settings, and sign-out (plus the
 * user's email) behind a single avatar trigger, so the header nav row stays
 * short instead of spreading these across four separate top-level buttons.
 * Mirrors the SpaceSwitcher popover pattern (outside-click + Escape close).
 */
export function AccountMenu({
  name,
  email,
  accountAria,
  settingsLabel,
  signOutLabel,
  themeLabel,
  onSignOut,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true,
  );
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage may be unavailable; the DOM change below still applies */
    }
    const html = document.documentElement;
    if (next === "light") {
      html.dataset.theme = "light";
      html.classList.remove("dark");
    } else {
      delete html.dataset.theme;
      html.classList.add("dark");
    }
  };

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/70";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={accountAria}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full outline-none ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-teal-500/60"
      >
        <Avatar size="sm" className="border border-zinc-200/80 dark:border-zinc-700/80">
          <AvatarFallback className="bg-teal-500/10 text-[11px] font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
            {initials(name, email)}
          </AvatarFallback>
        </Avatar>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lg shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {(name || email) && (
            <div className="min-w-0 px-2.5 py-2">
              {name ? (
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{name}</p>
              ) : null}
              {email ? (
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{email}</p>
              ) : null}
            </div>
          )}

          <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />

          <button type="button" role="menuitem" onClick={toggleTheme} className={itemClass}>
            {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{themeLabel}</span>
          </button>

          <Link href="/settings" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <Settings2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{settingsLabel}</span>
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{signOutLabel}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
