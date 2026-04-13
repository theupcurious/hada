"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Folder,
  Link2,
  MessageSquare,
  Network,
  Plus,
  Settings2,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { InputRule, Mark } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown as MarkdownExtension } from "tiptap-markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import type { Document } from "@/lib/types/database";

type DocListItem = Pick<Document, "id" | "title" | "folder" | "updated_at"> & {
  preview?: string;
  shared?: boolean;
};

type DocShareInfo = {
  shareId: string;
  shareUrl: string;
  createdAt: string;
};

type DocShareResponse = {
  share?: DocShareInfo | null;
  error?: string;
};

function toMarkdownFilename(title: string) {
  const sanitized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${sanitized || "hada-document"}.md`;
}


const WELCOME_DOC_CONTENT = `# Welcome to Hada

This is your **Docs** space — a library of documents your assistant can read and work from.

## How it works

Documents here act as context for your assistant. Reference them in chat:

> "Use my Priorities doc to plan my week"
> "Based on my About Me document, draft a short bio for my website"

Hada can also list and read your documents on its own when relevant.

## Suggested documents to create

- **About Me** — your role, background, working style, and preferences
- **Priorities** — current goals and focus areas (weekly or quarterly)
- **Projects** — active projects with status and next steps
- **Contacts** — key people, their roles, and context

## Tips

- Write in plain markdown — headings, bullets, and tables all work
- Keep documents focused on one topic so the assistant can reference them precisely
- Upload existing \`.md\` files using the ↑ button in the sidebar
- Update documents regularly so your assistant has fresh context
`;

// ── WikiLink Tiptap extension ────────────────────────────────────────────────

const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

/** Parses all [[Page Title]] references from a piece of text. */
function parseWikiLinks(text: string): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(WIKILINK_REGEX.source, "g");
  while ((m = re.exec(text)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

/**
 * Custom Tiptap Mark that renders [[Page Title]] as a styled interactive span.
 * The markdown serializer preserves the [[...]] syntax so the raw markdown
 * stored in the database is never corrupted.
 */
const WikiLinkMark = Mark.create({
  name: "wikilink",
  priority: 1001,

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-wikilink"),
        renderHTML: (attrs) => ({ "data-wikilink": attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-wikilink]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        class:
          "wikilink-mark cursor-pointer rounded-sm border-b border-violet-400 bg-violet-500/10 px-0.5 text-violet-600 hover:bg-violet-500/20 dark:border-violet-500 dark:text-violet-400 dark:hover:bg-violet-500/15 transition-colors",
      },
      0,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const title = match[1];
          const { tr } = state;
          const mark = this.type.create({ title });
          tr.replaceWith(range.from, range.to, state.schema.text(`[[${title}]]`, [mark]));
        },
      }),
    ];
  },
});

export default function DashboardPage() {

  return (
    <Suspense fallback={
      <div className="flex h-dvh items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageContent() {
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // 4a/4c: Wiki graph view
  const [showGraph, setShowGraph] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();


  const loadDocs = useCallback(async () => {
    const response = await fetch("/api/documents");
    if (!response.ok) return [];
    const data = (await response.json()) as { documents?: DocListItem[] };
    const list = data.documents ?? [];
    setDocs(list);
    return list;
  }, []);

  const loadFullDoc = useCallback(async (id: string) => {
    const response = await fetch(`/api/documents/${id}`);
    if (!response.ok) return;
    const data = (await response.json()) as { document?: Document };
    if (data.document) setActiveDoc(data.document);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const list = await loadDocs();
      if (!active) return;
      
      // Handle deep-linking via ?id= query param
      const initialId = searchParams.get("id");
      if (initialId) {
        const found = list.find(d => d.id === initialId);
        if (found) {
          setActiveDocId(initialId);
          await loadFullDoc(initialId);
          if (found.folder) {
            setExpandedFolders(prev => new Set([...prev, found.folder as string]));
          }
        }
      }

      // Seed welcome doc for new users
      if (active && list.length === 0) {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Welcome to Hada", content: WELCOME_DOC_CONTENT, folder: null }),
        });
        if (res.ok) {
          const created = (await res.json()) as { document?: Document };
          if (created.document && active) {
            setDocs([{ id: created.document.id, title: created.document.title, folder: null, updated_at: created.document.updated_at }]);
            setActiveDocId(created.document.id);
            setActiveDoc(created.document);
          }
        }
      }
      if (active) setIsLoading(false);
    }
    void initialize();
    return () => { active = false; };
  }, [loadDocs, loadFullDoc, searchParams]);

  const selectDoc = useCallback(async (id: string) => {
    setActiveDocId(id);
    setSidebarOpen(false);
    await loadFullDoc(id);
  }, [loadFullDoc]);

  const createDoc = useCallback(async (folder?: string | null) => {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled", content: "", folder: folder ?? null }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { document?: Document };
    if (!data.document) return;
    await loadDocs();
    setActiveDocId(data.document.id);
    setActiveDoc(data.document);
    if (folder) setExpandedFolders((prev) => new Set([...prev, folder]));
    setSidebarOpen(false);
  }, [loadDocs]);

  const deleteDoc = useCallback(async (id: string) => {
    if (!window.confirm("Delete this document?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    await loadDocs();
    if (activeDocId === id) { setActiveDocId(null); setActiveDoc(null); }
  }, [activeDocId, loadDocs]);

  const deleteFolder = useCallback(async (folder: string, docIds: string[]) => {
    const count = docIds.length;
    if (!count) return;
    const confirmed = window.confirm(
      `Delete folder "${folder}" and all ${count} document${count === 1 ? "" : "s"} inside it?`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/documents?folder=${encodeURIComponent(folder)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;

    await loadDocs();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.delete(folder);
      return next;
    });

    if (activeDocId && docIds.includes(activeDocId)) {
      setActiveDocId(null);
      setActiveDoc(null);
    }
  }, [activeDocId, loadDocs]);

  const startRename = useCallback((doc: DocListItem) => {
    setRenamingDocId(doc.id);
    setRenameValue(doc.title);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingDocId) return;
    const newTitle = renameValue.trim() || "Untitled";
    setRenamingDocId(null);
    await fetch(`/api/documents/${renamingDocId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    await loadDocs();
    // Update active doc title if it's the one being renamed
    setActiveDoc((prev) => prev?.id === renamingDocId ? { ...prev, title: newTitle } : prev);
  }, [renamingDocId, renameValue, loadDocs]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = String(evt.target?.result ?? "");
      const title = file.name.replace(/\.(md|txt)$/i, "");
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, folder: null }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { document?: Document };
      if (!data.document) return;
      await loadDocs();
      await selectDoc(data.document.id);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [loadDocs, selectDoc]);


  const toggleFolder = (name: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); } else { next.add(name); }
      return next;
    });
  };

  const handleNewFolder = () => {
    const name = newFolderName.trim();
    if (name) {
      setExpandedFolders((prev) => new Set([...prev, name]));
      void createDoc(name);
    }
    setNewFolderInput(false);
    setNewFolderName("");
  };

  // 4a: Pin wiki folder to the top of the list
  const folders = useMemo(() => {
    const all = [...new Set(docs.filter((d) => d.folder).map((d) => d.folder as string))];
    return all.sort((a, b) => {
      if (a === "wiki") return -1;
      if (b === "wiki") return 1;
      return a.localeCompare(b);
    });
  }, [docs]);

  // 4c: Build graph data from [[wikilinks]] in available content
  const graphData = useMemo(() => {
    const wikiDocs = docs.filter((d) => d.folder === "wiki");
    if (wikiDocs.length === 0) return null;

    const titleToId = new Map(wikiDocs.map((d) => [d.title.toLowerCase(), d.id]));
    const nodes = wikiDocs.map((d) => ({ id: d.id, title: d.title }));
    const edges: { from: string; to: string }[] = [];
    const missing = new Map<string, string>(); // title → synthetic id

    for (const doc of wikiDocs) {
      const content = (doc.id === activeDoc?.id ? activeDoc.content : null) ?? doc.preview ?? "";
      const links = parseWikiLinks(content);
      for (const link of links) {
        const targetId = titleToId.get(link.toLowerCase());
        if (targetId) {
          edges.push({ from: doc.id, to: targetId });
        } else {
          // orphan reference
          const synthId = `missing:${link}`;
          if (!missing.has(link)) missing.set(link, synthId);
          edges.push({ from: doc.id, to: synthId });
        }
      }
    }

    const missingNodes = [...missing.entries()].map(([title, id]) => ({ id, title, missing: true }));
    return { nodes: [...nodes, ...missingNodes], edges };
  }, [docs, activeDoc]);
  const rootDocs = docs.filter((d) => !d.folder);
  const wikiExists = docs.some((d) => d.folder === "wiki");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-400">Docs</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => void createDoc(null)} className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" title="New document">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <label htmlFor="doc-upload" className="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" title="Upload .md or .txt file">
            <Upload className="h-3.5 w-3.5" />
          </label>
          <input ref={fileInputRef} id="doc-upload" type="file" accept=".md,.txt,text/markdown,text/plain" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {folders.map((folder) => {
          const isWiki = folder === "wiki";
          const folderDocs = docs.filter((d) => d.folder === folder);
          const isExpanded = expandedFolders.has(folder);
          const lastUpdated = folderDocs.length > 0
            ? folderDocs.reduce((latest, d) => d.updated_at > latest ? d.updated_at : latest, folderDocs[0].updated_at)
            : null;
          const lastUpdatedLabel = lastUpdated
            ? (() => {
                const diffMs = Date.now() - new Date(lastUpdated).getTime();
                const diffMin = Math.floor(diffMs / 60_000);
                if (diffMin < 2) return "just now";
                if (diffMin < 60) return `${diffMin}m ago`;
                const diffH = Math.floor(diffMin / 60);
                if (diffH < 24) return `${diffH}h ago`;
                return `${Math.floor(diffH / 24)}d ago`;
              })()
            : null;

          return (
            <div key={folder} className="group">
              <div className="flex items-center gap-1">
                <button onClick={() => toggleFolder(folder)} className={cn(
                  "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  isWiki
                    ? "text-violet-700 hover:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/10"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}>
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                  {isWiki
                    ? <BookOpen className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                    : <Folder className="h-3.5 w-3.5 shrink-0 text-teal-500" />}
                  <span className="truncate font-medium">{isWiki ? "Wiki" : folder}</span>
                  {isWiki ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {lastUpdatedLabel && (
                        <span className="text-[10px] text-violet-400/70 dark:text-violet-500/70">{lastUpdatedLabel}</span>
                      )}
                      <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                        {folderDocs.length}
                      </span>
                    </span>
                  ) : (
                    <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{folderDocs.length}</span>
                  )}
                </button>
                {isWiki && graphData && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowGraph((v) => !v); }}
                    className={cn(
                      "shrink-0 rounded p-1 transition-colors",
                      showGraph
                        ? "bg-violet-500/15 text-violet-500"
                        : "opacity-0 text-zinc-400 group-hover:opacity-100 hover:bg-violet-500/10 hover:text-violet-500",
                    )}
                    title="Graph view"
                  >
                    <Network className="h-3.5 w-3.5" />
                  </button>
                )}
                {!isWiki && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteFolder(folder, folderDocs.map((doc) => doc.id));
                    }}
                    className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950/40"
                    title={`Delete folder ${folder}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400" />
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                    <div className="ml-3 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                      {folderDocs.map((doc) => (
                        <DocItem key={doc.id} doc={doc} isActive={activeDocId === doc.id} onSelect={selectDoc} onDelete={deleteDoc} isRenaming={renamingDocId === doc.id} renameValue={renameValue} onRenameStart={startRename} onRenameChange={setRenameValue} onRenameCommit={commitRename} onRenameCancel={() => setRenamingDocId(null)} />
                      ))}
                      <button onClick={() => void createDoc(folder)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300">
                        <Plus className="h-3 w-3" />New in {isWiki ? "wiki" : folder}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {rootDocs.map((doc) => (
          <DocItem key={doc.id} doc={doc} isActive={activeDocId === doc.id} onSelect={selectDoc} onDelete={deleteDoc} isRenaming={renamingDocId === doc.id} renameValue={renameValue} onRenameStart={startRename} onRenameChange={setRenameValue} onRenameCommit={commitRename} onRenameCancel={() => setRenamingDocId(null)} />
        ))}

        {newFolderInput ? (
          <div className="px-2 py-1">
            <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNewFolder(); if (e.key === "Escape") { setNewFolderInput(false); setNewFolderName(""); } }}
              onBlur={handleNewFolder} placeholder="Folder name"
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-teal-400 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
        ) : (
          <button onClick={() => setNewFolderInput(true)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300">
            <Folder className="h-3 w-3" />New folder
          </button>
        )}

        {docs.length === 0 && !isLoading && (
          <div className="px-2 py-6 text-center">
            <p className="text-xs text-zinc-400">No documents yet.</p>
            <button onClick={() => void createDoc(null)} className="mt-1 text-xs font-medium text-teal-500 hover:underline">Create your first one →</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200/80 bg-white/80 px-3 py-2.5 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button className="rounded-md p-1 text-zinc-500 md:hidden hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <FileText className="h-4 w-4" />
            </button>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden shadow-sm shadow-teal-500/20">
              <Image src="/hada-logo.png" alt="Hada" width={24} height={24} className="h-6 w-6 object-cover" />
            </div>
            <span className="font-semibold">Docs</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/settings"><Button variant="ghost" size="icon" aria-label="Settings"><Settings2 className="h-4 w-4" /></Button></Link>
            <Link href="/chat"><Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">Chat <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
            <Link href="/chat" className="sm:hidden"><Button variant="ghost" size="icon" aria-label="Chat"><MessageSquare className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
              <motion.div initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="fixed inset-y-0 left-0 z-30 w-60 bg-white pt-14 shadow-xl dark:bg-zinc-900 md:hidden">
                <button onClick={() => setSidebarOpen(false)} className="absolute right-2 top-16 rounded p-1 text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
                {sidebar}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="hidden w-56 shrink-0 flex-col border-r border-zinc-200/70 bg-white/60 backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50 md:flex">
          {sidebar}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-zinc-400">Loading...</span>
            </div>
          ) : showGraph && graphData ? (
            <WikiGraphView
              data={graphData}
              activeDocId={activeDocId}
              onSelectDoc={(id) => { setShowGraph(false); void selectDoc(id); }}
              onClose={() => setShowGraph(false)}
            />
          ) : activeDoc ? (
            <WysiwygPane
              key={activeDoc.id}
              doc={activeDoc}
              isSaving={isSaving}
              onSave={async (title, content, folder) => {
                setIsSaving(true);
                try {
                  const response = await fetch(`/api/documents/${activeDoc.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, content, folder: folder || null }),
                  });
                  if (!response.ok) return false;

                  const data = (await response.json()) as { document?: Document };
                  if (data.document) setActiveDoc(data.document);
                  await loadDocs();
                  return true;
                } finally {
                  setIsSaving(false);
                }
              }}
              onDelete={() => void deleteDoc(activeDoc.id)}
              onRefreshDocs={loadDocs}
              folders={folders}
              onNavigateToDoc={(id) => void selectDoc(id)}
              wikiExists={wikiExists}
              router={router}
            />
          ) : (
            <EmptyPane onCreate={() => void createDoc(null)} />
          )}
        </div>
      </div>
    </div>
  );
}


function WysiwygPane({
  doc,
  isSaving,
  onSave,
  onDelete,
  onRefreshDocs,
  folders,
  onNavigateToDoc,
  wikiExists,
  router,
}: {
  doc: Document;
  isSaving: boolean;
  onSave: (title: string, content: string, folder: string) => Promise<boolean>;
  onDelete: () => void;
  onRefreshDocs: () => Promise<DocListItem[]>;
  folders: string[];
  onNavigateToDoc: (id: string) => void;
  wikiExists: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [title, setTitle] = useState(doc.title);
  const [folder, setFolder] = useState(doc.folder ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [shareInfo, setShareInfo] = useState<DocShareInfo | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [isRevokingShare, setIsRevokingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      MarkdownExtension.configure({ html: false, transformPastedText: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      WikiLinkMark,
    ],
    content: doc.content,
    editorProps: {
      attributes: {
        class: "outline-none min-h-full px-5 py-5 sm:px-8 wysiwyg-editor",
      },
    },
    onUpdate: () => setIsDirty(true),
  });

  // 4b: Handle clicks on [[wikilink]] spans inside the editor
  const handleEditorClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest("[data-wikilink]");
    if (!target) return;
    const title = (target as HTMLElement).getAttribute("data-wikilink");
    if (!title) return;
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/documents/by-title?title=${encodeURIComponent(title)}&folder=wiki`);
    if (res.ok) {
      const data = await res.json() as { id?: string };
      if (data.id) onNavigateToDoc(data.id);
    }
  }, [onNavigateToDoc]);

  const getMarkdownContent = () => {
    if (!editor) return doc.content;
    const storage = editor.storage as unknown as Record<string, { getMarkdown?: () => string }>;
    return storage.markdown?.getMarkdown?.() ?? editor.getText();
  };

  const handleSave = async () => {
    const md = getMarkdownContent();
    const saved = await onSave(title, md, folder);
    if (saved) setIsDirty(false);
    return saved;
  };

  const handleDownload = () => {
    const blob = new Blob([getMarkdownContent()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = toMarkdownFilename(title);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const canIngestIntoWiki = doc.folder !== "wiki" && wikiExists;

  const handleIngestIntoWiki = () => {
    const prompt = `Ingest "${doc.title}" (document id: ${doc.id}) into my wiki`;
    router.push(`/chat?draft=${encodeURIComponent(prompt)}`);
  };

  const prepareShare = async () => {
    setShareError(null);
    setIsPreparingShare(true);
    setCopiedShareLink(false);

    try {
      if (isDirty) {
        const saved = await handleSave();
        if (!saved) {
          setShareError("Could not save the latest changes before sharing.");
          return;
        }
      }

      const response = await fetch(`/api/documents/${doc.id}/share`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as DocShareResponse;
      if (!response.ok || !data.share) {
        setShareError(data.error ?? "Failed to create share link.");
        return;
      }

      setShareInfo(data.share);
      await onRefreshDocs();
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Failed to create share link.");
    } finally {
      setIsPreparingShare(false);
    }
  };

  const handleOpenShareModal = async () => {
    setShowShareModal(true);
    await prepareShare();
  };

  const handleCopyShareLink = async () => {
    if (!shareInfo) return;
    try {
      await navigator.clipboard.writeText(shareInfo.shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 1600);
    } catch {
      setShareError("Could not copy the share link.");
    }
  };

  const handleStopSharing = async () => {
    setIsRevokingShare(true);
    setShareError(null);

    try {
      const response = await fetch(`/api/documents/${doc.id}/share`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setShareError(data.error ?? "Failed to disable sharing.");
        return;
      }

      setShareInfo(null);
      setCopiedShareLink(false);
      await onRefreshDocs();
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Failed to disable sharing.");
    } finally {
      setIsRevokingShare(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200/60 px-4 py-2.5 dark:border-zinc-800/60">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
            placeholder="Document title"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          />
          <select
            value={folder}
            onChange={(e) => { setFolder(e.target.value); setIsDirty(true); }}
            className="shrink-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="">No folder</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isDirty && (
            <Button size="sm" onClick={() => void handleSave()} disabled={isSaving} className="gradient-brand text-white border-0">
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleDownload} title="Download markdown">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleOpenShareModal()} disabled={isPreparingShare || isSaving} title="Share document">
            <Share2 className="h-4 w-4" />
          </Button>
          {canIngestIntoWiki ? (
            <Button size="sm" variant="ghost" onClick={handleIngestIntoWiki}>
              Ingest into Wiki
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 dark:text-red-400" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* WYSIWYG editor */}
      <div className="flex-1 overflow-y-auto">
        <style>{`
          .wysiwyg-editor h1 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.75rem; color: inherit; }
          .wysiwyg-editor h2 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; color: inherit; }
          .wysiwyg-editor h3 { font-size: 1.1rem; font-weight: 600; margin: 0.875rem 0 0.375rem; color: inherit; }
          .wysiwyg-editor h1:first-child, .wysiwyg-editor h2:first-child, .wysiwyg-editor h3:first-child { margin-top: 0; }
          .wysiwyg-editor p { margin-bottom: 0.75rem; line-height: 1.7; }
          .wysiwyg-editor ul { list-style: disc; margin: 0 0 0.75rem 1.25rem; }
          .wysiwyg-editor ol { list-style: decimal; margin: 0 0 0.75rem 1.25rem; }
          .wysiwyg-editor li { margin-bottom: 0.25rem; line-height: 1.6; }
          .wysiwyg-editor blockquote { border-left: 2px solid #14b8a6; padding-left: 1rem; color: #71717a; font-style: italic; margin-bottom: 0.75rem; }
          .wysiwyg-editor code { background: rgba(113,113,122,0.12); border-radius: 0.25rem; padding: 0.1em 0.35em; font-size: 0.85em; font-family: ui-monospace, monospace; }
          .wysiwyg-editor pre { background: rgba(113,113,122,0.1); border-radius: 0.5rem; padding: 0.875rem 1rem; overflow-x: auto; margin-bottom: 1rem; }
          .wysiwyg-editor pre code { background: none; padding: 0; font-size: 0.85rem; }
          .wysiwyg-editor table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; font-size: 0.875rem; }
          .wysiwyg-editor th { border: 1px solid rgba(113,113,122,0.3); padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; background: rgba(113,113,122,0.08); }
          .wysiwyg-editor td { border: 1px solid rgba(113,113,122,0.3); padding: 0.5rem 0.75rem; }
          .wysiwyg-editor hr { border: none; border-top: 1px solid rgba(113,113,122,0.2); margin: 1.25rem 0; }
          .wysiwyg-editor a { color: #0d9488; text-decoration: underline; }
          .wysiwyg-editor strong { font-weight: 600; }
          .wysiwyg-editor .is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: #a1a1aa; pointer-events: none; height: 0; }
        `}</style>
        <div onClick={(e) => void handleEditorClick(e)}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {showShareModal ? (
        <DocShareModal
          isLoading={isPreparingShare}
          shareInfo={shareInfo}
          error={shareError}
          isRevoking={isRevokingShare}
          copied={copiedShareLink}
          onClose={() => {
            setShowShareModal(false);
            setShareError(null);
            setCopiedShareLink(false);
          }}
          onCopy={() => void handleCopyShareLink()}
          onRefresh={() => void prepareShare()}
          onStopSharing={() => void handleStopSharing()}
        />
      ) : null}
    </div>
  );
}

function DocShareModal({
  isLoading,
  shareInfo,
  error,
  isRevoking,
  copied,
  onClose,
  onCopy,
  onRefresh,
  onStopSharing,
}: {
  isLoading: boolean;
  shareInfo: DocShareInfo | null;
  error: string | null;
  isRevoking: boolean;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
  onRefresh: () => void;
  onStopSharing: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Share document
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Anyone with the link can view this document.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {isLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Preparing share link...
            </div>
          ) : shareInfo ? (
            <>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-teal-500/10 p-2 text-teal-600 dark:text-teal-400">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                      Public link
                    </p>
                    <p className="mt-1 break-all text-sm text-zinc-700 dark:text-zinc-300">
                      {shareInfo.shareUrl}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Signed-in Hada users can save this shared document to their own docs.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Sharing is currently disabled for this document.
            </div>
          )}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {shareInfo ? (
            <>
              <Button variant="outline" size="sm" onClick={onCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button variant="outline" size="sm" onClick={onStopSharing} disabled={isRevoking}>
                {isRevoking ? "Stopping..." : "Stop sharing"}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onRefresh} disabled={isLoading}>
              <Share2 className="h-4 w-4" />
              Create link
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 4c: Wiki graph view ──────────────────────────────────────────────────────

type GraphNode = { id: string; title: string; missing?: boolean };
type GraphEdge = { from: string; to: string };

function WikiGraphView({
  data,
  activeDocId,
  onSelectDoc,
  onClose,
}: {
  data: { nodes: GraphNode[]; edges: GraphEdge[] };
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onClose: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);

  // Node positions as a ref (mutated by physics, triggering DOM updates directly)
  const posRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const [, forceRender] = useState(0);

  // Inbound link count per node (for hub sizing)
  const inbound = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data.edges) {
      counts.set(e.to, (counts.get(e.to) ?? 0) + 1);
    }
    return counts;
  }, [data.edges]);

  // Initialize positions in a circle
  useEffect(() => {
    const { nodes } = data;
    const W = svgRef.current?.clientWidth ?? 600;
    const H = svgRef.current?.clientHeight ?? 400;
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.35;
    posRef.current = new Map(
      nodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / nodes.length;
        return [n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 }];
      })
    );

    let tick = 0;
    const step = () => {
      tick++;
      const pos = posRef.current;
      const W2 = svgRef.current?.clientWidth ?? 600;
      const H2 = svgRef.current?.clientHeight ?? 400;
      const cx2 = W2 / 2, cy2 = H2 / 2;

      // Spring edges
      for (const e of data.edges) {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealLen = 110;
        const force = (dist - idealLen) * 0.04;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Repulsion between all nodes
      const nodeList = nodes.map((n) => pos.get(n.id)!);
      for (let i = 0; i < nodeList.length; i++) {
        for (let j = i + 1; j < nodeList.length; j++) {
          const a = nodeList[i], b = nodeList[j];
          if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const rep = 2200 / (dist * dist);
          const fx = (dx / dist) * rep, fy = (dy / dist) * rep;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Gravity toward center
      for (const p of pos.values()) {
        p.vx += (cx2 - p.x) * 0.008;
        p.vy += (cy2 - p.y) * 0.008;
        // Damping
        p.vx *= 0.78;
        p.vy *= 0.78;
        p.x += p.vx;
        p.y += p.vy;
      }

      if (tick % 3 === 0) forceRender((n) => n + 1); // re-render every 3 ticks
      if (tick < 160) {
        animRef.current = requestAnimationFrame(step);
      }
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [data]);

  const pos = posRef.current;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/60 px-4 py-2.5 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Wiki Graph</span>
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
            {data.nodes.filter(n => !n.missing).length} pages · {data.edges.length} links
          </span>
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute right-4 top-14 z-10 flex flex-col gap-1 rounded-lg border border-zinc-200/60 bg-white/80 p-2 text-[10px] text-zinc-500 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Wiki page</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" />Active</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-dashed border-zinc-400" />Missing page</span>
      </div>

      {/* SVG graph */}
      <svg ref={svgRef} className="flex-1 w-full h-full">
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#a78bfa" fillOpacity="0.5" />
          </marker>
        </defs>

        {/* Edges */}
        {data.edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#a78bfa"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {/* Nodes */}
        {data.nodes.map((node) => {
          const p = pos.get(node.id);
          if (!p) return null;
          const hubCount = inbound.get(node.id) ?? 0;
          const r = node.missing ? 5 : Math.max(8, Math.min(22, 9 + hubCount * 3));
          const isActive = node.id === activeDocId;

          return (
            <g
              key={node.id}
              transform={`translate(${p.x},${p.y})`}
              style={{ cursor: node.missing ? "default" : "pointer" }}
              onClick={() => !node.missing && onSelectDoc(node.id)}
            >
              <circle
                r={r}
                fill={node.missing ? "transparent" : isActive ? "#f97316" : "#8b5cf6"}
                fillOpacity={node.missing ? 0 : 0.85}
                stroke={node.missing ? "#a1a1aa" : isActive ? "#f97316" : "#7c3aed"}
                strokeWidth={node.missing ? 1.5 : 2}
                strokeDasharray={node.missing ? "3 2" : undefined}
              />
              {isActive && <circle r={r + 4} fill="none" stroke="#f97316" strokeWidth={1.5} strokeOpacity={0.4} />}
              <text
                textAnchor="middle"
                dy={r + 12}
                fontSize={10}
                fill="currentColor"
                className="select-none fill-zinc-600 dark:fill-zinc-400"
              >
                {node.title.length > 18 ? node.title.slice(0, 17) + "…" : node.title}
              </text>
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}

function DocItem({
  doc, isActive, onSelect,
  onDelete,
  isRenaming, renameValue, onRenameStart, onRenameChange, onRenameCommit, onRenameCancel,
}: {
  doc: DocListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isRenaming: boolean;
  renameValue: string;
  onRenameStart: (doc: DocListItem) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.select();
  }, [isRenaming]);

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1 bg-teal-500/10">
        <FileText className="h-3.5 w-3.5 shrink-0 text-teal-500" />
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onRenameCommit(); }
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={onRenameCommit}
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive ? "bg-teal-500/10 text-teal-700 dark:text-teal-300" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      <button onClick={() => onSelect(doc.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <FileText className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-teal-500" : "text-zinc-400")} />
        <span className="truncate">{doc.title}</span>
        {doc.shared ? (
          <span className="shrink-0 rounded-full bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-teal-600 dark:text-teal-400">
            Shared
          </span>
        ) : null}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRenameStart(doc); }}
        className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        title="Rename"
      >
        <svg className="h-3 w-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); void onDelete(doc.id); }}
        className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950/40"
        title="Delete"
      >
        <Trash2 className="h-3 w-3 text-zinc-400 hover:text-red-500 dark:hover:text-red-400" />
      </button>
    </div>
  );
}

function EmptyPane({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700">
        <FileText className="h-6 w-6 text-zinc-400" />
      </div>
      <div>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Select a document</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">or create a new one to get started</p>
      </div>
      <Button size="sm" onClick={onCreate} className="mt-1 gap-1.5">
        <Plus className="h-3.5 w-3.5" />New document
      </Button>
    </div>
  );
}
