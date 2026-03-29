"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Document } from "@/lib/types/database";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DocListItem = Pick<Document, "id" | "title" | "folder" | "updated_at"> & { preview?: string };

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editFolder, setEditFolder] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadDocs = useCallback(async () => {
    const response = await fetch("/api/documents");
    if (!response.ok) return;
    const data = (await response.json()) as { documents?: DocListItem[] };
    setDocs(data.documents ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) { router.push("/auth/login"); return; }
      await loadDocs();
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
    setIsEditing(false);
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
    setEditTitle(data.document.title);
    setEditContent(data.document.content);
    setEditFolder(data.document.folder ?? "");
    setIsEditing(true);
    if (folder) setExpandedFolders((prev) => new Set([...prev, folder]));
    setSidebarOpen(false);
  }, [loadDocs]);

  const saveDoc = useCallback(async () => {
    if (!activeDocId) return;
    setIsSaving(true);
    const response = await fetch(`/api/documents/${activeDocId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle.trim() || "Untitled",
        content: editContent,
        folder: editFolder.trim() || null,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { document?: Document };
      if (data.document) setActiveDoc(data.document);
      await loadDocs();
      setIsEditing(false);
    }
    setIsSaving(false);
  }, [activeDocId, editTitle, editContent, editFolder, loadDocs]);

  const deleteDoc = useCallback(async (id: string) => {
    if (!window.confirm("Delete this document?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    await loadDocs();
    if (activeDocId === id) {
      setActiveDocId(null);
      setActiveDoc(null);
      setIsEditing(false);
    }
  }, [activeDocId, loadDocs]);

  const startEdit = useCallback(() => {
    if (!activeDoc) return;
    setEditTitle(activeDoc.title);
    setEditContent(activeDoc.content);
    setEditFolder(activeDoc.folder ?? "");
    setIsEditing(true);
  }, [activeDoc]);

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

  // Build folder tree from docs
  const folders = [...new Set(docs.filter((d) => d.folder).map((d) => d.folder as string))].sort();
  const rootDocs = docs.filter((d) => !d.folder);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-400">Documents</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => void createDoc(null)}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="New document"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <label
            htmlFor="doc-upload"
            className="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="Upload .md file"
          >
            <Upload className="h-3.5 w-3.5" />
          </label>
          <input
            ref={fileInputRef}
            id="doc-upload"
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {/* Folders */}
        {folders.map((folder) => {
          const folderDocs = docs.filter((d) => d.folder === folder);
          const isExpanded = expandedFolders.has(folder);
          return (
            <div key={folder}>
              <button
                onClick={() => toggleFolder(folder)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                <Folder className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                <span className="truncate font-medium">{folder}</span>
                <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{folderDocs.length}</span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-3 border-l border-zinc-200/70 pl-2 dark:border-zinc-800">
                      {folderDocs.map((doc) => (
                        <DocItem
                          key={doc.id}
                          doc={doc}
                          isActive={activeDocId === doc.id}
                          onSelect={selectDoc}
                        />
                      ))}
                      <button
                        onClick={() => void createDoc(folder)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        <Plus className="h-3 w-3" />
                        New in {folder}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Root docs */}
        {rootDocs.map((doc) => (
          <DocItem
            key={doc.id}
            doc={doc}
            isActive={activeDocId === doc.id}
            onSelect={selectDoc}
          />
        ))}

        {/* New folder */}
        {newFolderInput ? (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNewFolder();
                if (e.key === "Escape") { setNewFolderInput(false); setNewFolderName(""); }
              }}
              onBlur={handleNewFolder}
              placeholder="Folder name"
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-teal-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        ) : (
          <button
            onClick={() => setNewFolderInput(true)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <Folder className="h-3 w-3" />
            New folder
          </button>
        )}

        {docs.length === 0 && !isLoading && (
          <div className="px-2 py-6 text-center">
            <p className="text-xs text-zinc-400">No documents yet.</p>
            <button
              onClick={() => void createDoc(null)}
              className="mt-1 text-xs font-medium text-teal-500 hover:underline"
            >
              Create your first one →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-200/80 bg-white/80 px-3 py-2.5 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* Mobile sidebar toggle */}
            <button
              className="rounded-md p-1 text-zinc-500 md:hidden hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FileText className="h-4 w-4" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand shadow-sm shadow-teal-500/20">
              <span className="text-xs font-bold text-white">H</span>
            </div>
            <span className="font-semibold">Documents</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/settings">
              <Button variant="ghost" size="icon" aria-label="Settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
                Chat <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/chat" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="Chat">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-20 bg-black/30 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -240 }}
                animate={{ x: 0 }}
                exit={{ x: -240 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-30 w-60 bg-white pt-14 shadow-xl dark:bg-zinc-900 md:hidden"
              >
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="absolute right-2 top-16 rounded p-1 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
                {sidebar}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop sidebar */}
        <div className="hidden w-56 shrink-0 flex-col border-r border-zinc-200/70 bg-white/60 backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50 md:flex">
          {sidebar}
        </div>

        {/* Content pane */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-zinc-400">Loading...</span>
            </div>
          ) : activeDoc ? (
            isEditing ? (
              <EditorPane
                title={editTitle}
                content={editContent}
                folder={editFolder}
                folders={folders}
                isSaving={isSaving}
                onTitleChange={setEditTitle}
                onContentChange={setEditContent}
                onFolderChange={setEditFolder}
                onSave={saveDoc}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <ViewPane
                doc={activeDoc}
                onEdit={startEdit}
                onDelete={() => void deleteDoc(activeDoc.id)}
              />
            )
          ) : (
            <EmptyPane onCreate={() => void createDoc(null)} />
          )}
        </div>
      </div>
    </div>
  );
}

function DocItem({
  doc,
  isActive,
  onSelect,
}: {
  doc: DocListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(doc.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        isActive
          ? "bg-teal-500/10 text-teal-700 dark:text-teal-300"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      <FileText className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-teal-500" : "text-zinc-400")} />
      <span className="truncate">{doc.title}</span>
      <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{formatUpdated(doc.updated_at)}</span>
    </button>
  );
}

function ViewPane({
  doc,
  onEdit,
  onDelete,
}: {
  doc: Document;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/60 px-5 py-3 dark:border-zinc-800/60">
        <div>
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">{doc.title}</h1>
          {doc.folder && (
            <p className="text-xs text-zinc-400">{doc.folder} / {doc.title}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-600 dark:text-red-400"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8">
        {doc.content ? (
          <div className="prose prose-zinc max-w-none dark:prose-invert prose-headings:font-semibold prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] dark:prose-code:bg-zinc-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 italic">Empty document. Click Edit to start writing.</p>
        )}
      </div>
    </div>
  );
}

function EditorPane({
  title,
  content,
  folder,
  folders,
  isSaving,
  onTitleChange,
  onContentChange,
  onFolderChange,
  onSave,
  onCancel,
}: {
  title: string;
  content: string;
  folder: string;
  folders: string[];
  isSaving: boolean;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onFolderChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/60 px-4 py-2.5 dark:border-zinc-800/60">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Document title"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          />
          <select
            value={folder}
            onChange={(e) => onFolderChange(e.target.value)}
            className="shrink-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button size="sm" onClick={onSave} disabled={isSaving} className="gradient-brand text-white border-0">
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Write in markdown..."
        className="flex-1 resize-none bg-transparent px-5 py-5 font-mono text-sm leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-200 sm:px-8"
        spellCheck={false}
      />
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
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          or create a new one to get started
        </p>
      </div>
      <Button size="sm" onClick={onCreate} className="mt-1 gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        New document
      </Button>
    </div>
  );
}
