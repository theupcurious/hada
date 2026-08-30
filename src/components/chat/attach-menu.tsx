"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttachedDoc } from "@/components/chat/doc-attach-picker";

interface ApiDoc {
  id: string;
  title: string;
  folder: string | null;
  content: string;
}

const ACCEPT =
  ".pdf,.docx,.xlsx,.xls,.csv,.tsv,.txt,.md,.markdown,.json,.log,application/pdf,text/*";

interface AttachMenuProps {
  attachedDocs: AttachedDoc[];
  onAttach: (doc: AttachedDoc) => void;
  disabled?: boolean;
  /** Accessible label / tooltip for the trigger. */
  title?: string;
}

/**
 * Unified attach control — one paperclip that both uploads a file from the
 * device and attaches an existing document, replacing the two separate
 * paperclip buttons that read as redundant in the composer.
 */
export function AttachMenu({ attachedDocs, onAttach, disabled, title }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<ApiDoc[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/documents");
        const d = r.ok ? ((await r.json()) as { documents?: ApiDoc[] }) : null;
        if (d?.documents) setDocs(d.documents);
      } catch {
        /* ignore — upload still works without the doc list */
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/attachments/extract", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => null)) as
          | { title?: string; content?: string; error?: string }
          | null;
        if (!response.ok || !data?.content) {
          throw new Error(data?.error || `Couldn't read ${file.name}.`);
        }
        onAttach({
          id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: data.title || file.name,
          content: data.content,
        });
      }
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      window.setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const attachedIds = new Set(attachedDocs.map((d) => d.id));
  const filtered = docs.filter(
    (d) => !attachedIds.has(d.id) && d.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={containerRef} className="relative flex items-center">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={title ?? "Attach a document or file"}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title ?? "Attach a document or file"}
        className={`h-7 w-7 shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${open ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" : ""}`}
      >
        <Paperclip className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Upload from device */}
          <button
            type="button"
            role="menuitem"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
            ) : (
              <Upload className="h-4 w-4 shrink-0 text-zinc-400" />
            )}
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Upload from your device
            </span>
          </button>

          {error ? (
            <p className="border-b border-zinc-100 px-3 py-2 text-xs text-red-500 dark:border-zinc-800" title={error}>
              {error}
            </p>
          ) : null}

          {/* Attach an existing document */}
          <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Attach a document</p>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docs…"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-7 pr-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-teal-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
                  role="menuitem"
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
                    {doc.folder && <p className="truncate text-xs text-zinc-400">{doc.folder}</p>}
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
