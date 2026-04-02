"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  MessageSquare,
  Plus,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown as MarkdownExtension } from "tiptap-markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Document } from "@/lib/types/database";

type DocListItem = Pick<Document, "id" | "title" | "folder" | "updated_at"> & { preview?: string };


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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const loadDocs = useCallback(async () => {
    const response = await fetch("/api/documents");
    if (!response.ok) return [];
    const data = (await response.json()) as { documents?: DocListItem[] };
    const list = data.documents ?? [];
    setDocs(list);
    return list;
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) { router.push("/auth/login"); return; }
      const list = await loadDocs();
      
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
  }, [router, supabase, loadDocs]);

  const loadFullDoc = useCallback(async (id: string) => {
    const response = await fetch(`/api/documents/${id}`);
    if (!response.ok) return;
    const data = (await response.json()) as { document?: Document };
    if (data.document) setActiveDoc(data.document);
  }, []);

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
      const title = file.name.replace(/\.md$/i, "");
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

  const folders = [...new Set(docs.filter((d) => d.folder).map((d) => d.folder as string))].sort();
  const rootDocs = docs.filter((d) => !d.folder);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-400">Docs</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => void createDoc(null)} className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" title="New document">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <label htmlFor="doc-upload" className="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" title="Upload .md file">
            <Upload className="h-3.5 w-3.5" />
          </label>
          <input ref={fileInputRef} id="doc-upload" type="file" accept=".md,text/markdown" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {folders.map((folder) => {
          const folderDocs = docs.filter((d) => d.folder === folder);
          const isExpanded = expandedFolders.has(folder);
          return (
            <div key={folder}>
              <button onClick={() => toggleFolder(folder)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                <Folder className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                <span className="truncate font-medium">{folder}</span>
                <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{folderDocs.length}</span>
              </button>
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                    <div className="ml-3 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                      {folderDocs.map((doc) => (
                        <DocItem key={doc.id} doc={doc} isActive={activeDocId === doc.id} onSelect={selectDoc} isRenaming={renamingDocId === doc.id} renameValue={renameValue} onRenameStart={startRename} onRenameChange={setRenameValue} onRenameCommit={commitRename} onRenameCancel={() => setRenamingDocId(null)} />
                      ))}
                      <button onClick={() => void createDoc(folder)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300">
                        <Plus className="h-3 w-3" />New in {folder}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {rootDocs.map((doc) => (
          <DocItem key={doc.id} doc={doc} isActive={activeDocId === doc.id} onSelect={selectDoc} isRenaming={renamingDocId === doc.id} renameValue={renameValue} onRenameStart={startRename} onRenameChange={setRenameValue} onRenameCommit={commitRename} onRenameCancel={() => setRenamingDocId(null)} />
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
          ) : activeDoc ? (
            <WysiwygPane
              key={activeDoc.id}
              doc={activeDoc}
              isSaving={isSaving}
              onSave={async (title, content, folder) => {
                setIsSaving(true);
                const response = await fetch(`/api/documents/${activeDoc.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title, content, folder: folder || null }),
                });
                if (response.ok) {
                  const data = (await response.json()) as { document?: Document };
                  if (data.document) setActiveDoc(data.document);
                  await loadDocs();
                }
                setIsSaving(false);
              }}
              onDelete={() => void deleteDoc(activeDoc.id)}
              folders={folders}
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
  folders,
}: {
  doc: Document;
  isSaving: boolean;
  onSave: (title: string, content: string, folder: string) => Promise<void>;
  onDelete: () => void;
  folders: string[];
}) {
  const [title, setTitle] = useState(doc.title);
  const [folder, setFolder] = useState(doc.folder ?? "");
  const [isDirty, setIsDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      MarkdownExtension.configure({ html: false, transformPastedText: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: doc.content,
    editorProps: {
      attributes: {
        class: "outline-none min-h-full px-5 py-5 sm:px-8 wysiwyg-editor",
      },
    },
    onUpdate: () => setIsDirty(true),
  });

  const handleSave = async () => {
    if (!editor) return;
    const storage = editor.storage as unknown as Record<string, { getMarkdown?: () => string }>;
    const md = storage.markdown?.getMarkdown?.() ?? editor.getText();
    await onSave(title, md, folder);
    setIsDirty(false);
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
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gradient-brand text-white border-0">
              {isSaving ? "Saving…" : "Save"}
            </Button>
          )}
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
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function DocItem({
  doc, isActive, onSelect,
  isRenaming, renameValue, onRenameStart, onRenameChange, onRenameCommit, onRenameCancel,
}: {
  doc: DocListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
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
