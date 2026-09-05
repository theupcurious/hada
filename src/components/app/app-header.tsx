"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import { cn } from "@/lib/utils";

interface HeaderProps { children?: ReactNode; spaceControl?: ReactNode; space?: { id: string; name: string } | null; }
const labels = {
  en: ["Chat", "Spaces", "Docs", "Workflows", "Activity", "Settings", "More", "General"],
  ko: ["채팅", "스페이스", "문서", "워크플로우", "활동", "설정", "더 보기", "일반"],
  ja: ["チャット", "スペース", "文書", "ワークフロー", "アクティビティ", "設定", "その他", "一般"],
  zh: ["聊天", "空间", "文档", "工作流", "活动", "设置", "更多", "通用"],
};
const paths = ["/chat", "/projects", "/docs", "/workflows", "/activity", "/settings"];

export function AppHeader(props: HeaderProps) {
  return <Suspense fallback={<div className="h-24 border-b border-border" />}><HeaderContent {...props} /></Suspense>;
}

function HeaderContent({ children, space, spaceControl }: HeaderProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const locale = useResolvedLocale();
  const copy = labels[locale];
  const projectId = space === undefined ? params.get("project") : space?.id;
  const [resolved, setResolved] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!projectId || space !== undefined) return;
    let cancelled = false;
    void fetch(`/api/projects/${encodeURIComponent(projectId)}`).then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled) setResolved(data?.project ?? null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, space]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  const href = (path: string) => projectId ? `${path}?project=${encodeURIComponent(projectId)}` : path;
  const active = (path: string) => pathname === path || (path === "/workflows" && pathname === "/settings" && params.get("tab") === "tasks");
  const linkClass = (selected: boolean) => cn("rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-teal-500", selected ? "bg-teal-500/10 text-teal-700 dark:text-teal-300" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800");
  return <header className="sticky top-0 z-30 shrink-0 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
    <div className="flex min-h-14 items-center justify-between gap-2 px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={href("/chat")} className="flex shrink-0 items-center gap-2 font-semibold"><Image src="/hada-logo.png" alt="" width={24} height={24} />Hada</Link>
        {spaceControl ?? <Link href={href("/chat")} aria-label={`Active space: ${space?.name || (resolved?.id === projectId ? resolved?.name : "") || (projectId ? "Space" : copy[7])}`} className="max-w-36 truncate rounded-full border border-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          {space?.name || (resolved?.id === projectId ? resolved?.name : "") || (projectId ? "Space" : copy[7])}
        </Link>}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children ?? <ThemeToggle />}</div>
    </div>
    <nav aria-label="Main navigation" className="flex items-center gap-0.5 px-2 pb-2 sm:px-4">
      {paths.map((path, i) => <Link key={path} href={href(path)} aria-current={active(path) ? "page" : undefined}
        className={cn(linkClass(active(path)), i !== 0 && i !== 2 && !active(path) && "hidden sm:block")}>{copy[i]}</Link>)}
      <div className="relative ml-auto sm:hidden" ref={menu}>
        <button ref={toggle} type="button" aria-expanded={open} aria-controls="app-more-navigation" onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-md px-3 py-2 text-sm">{copy[6]}<ChevronDown className="h-4 w-4" /></button>
        {open && <div id="app-more-navigation" className="absolute right-0 top-full z-50 mt-1 grid w-48 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {paths.map((path, i) => <Link key={path} href={href(path)} className={linkClass(active(path))} onClick={() => setOpen(false)}>{copy[i]}</Link>)}
        </div>}
      </div>
    </nav>
  </header>;
}
