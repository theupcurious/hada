"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiDoc {
  id: string;
  title: string;
  folder: string | null;
  content: string;
}

export interface AttachedDoc {
  id: string;
  title: string;
  content: string;
}

interface DocAttachPickerProps {
  attachedDocs: AttachedDoc[];
  onAttach: (doc: AttachedDoc) => void;
  onDetach: (docId: string) => void;
}

export function DocAttachPicker({ attachedDocs, onAttach }: DocAttachPickerProps) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<ApiDoc[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/documents");
        const d = r.ok ? ((await r.json()) as { documents?: ApiDoc[] }) : null;
        if (d?.documents) setDocs(d.documents);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const attachedIds = new Set(attachedDocs.map((d) => d.id));
  const filtered = docs.filter(
    (d) => !attachedIds.has(d.id) && d.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={containerRef} className="relative flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        title="Attach a document"
        className={`h-7 w-7 shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${open ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" : ""}`}
      >
        <Paperclip className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Attach a document</p>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docs…"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-7 pr-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-teal-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1.5">
            {loading ? (
              <p className="py-4 text-center text-xs text-zinc-400">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">
                {docs.length === 0 ? "No documents yet" : "No matches"}
              </p>
            ) : (
              filtered.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    onAttach({ id: doc.id, title: doc.title, content: doc.content });
                    setSearch("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {doc.title}
                    </p>
                    {doc.folder && (
                      <p className="truncate text-xs text-zinc-400">{doc.folder}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AttachedDocChipsProps {
  attachedDocs: AttachedDoc[];
  onDetach: (docId: string) => void;
}

export function AttachedDocChips({ attachedDocs, onDetach }: AttachedDocChipsProps) {
  if (attachedDocs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800/60">
      {attachedDocs.map((doc) => (
        <span
          key={doc.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-300"
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="max-w-[160px] truncate">{doc.title}</span>
          <button
            type="button"
            onClick={() => onDetach(doc.id)}
            className="ml-0.5 rounded-full text-teal-500 hover:text-teal-700 dark:hover:text-teal-200"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
