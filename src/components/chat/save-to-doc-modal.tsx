"use client";

import { useState, useEffect } from "react";
import { Check, FileText, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocItem {
  id: string;
  title: string;
  folder: string | null;
  preview?: string;
}

interface SaveToDocModalProps {
  content: string;
  onClose: () => void;
}

function extractTitle(content: string): string {
  const match = content.match(/^#{1,3}\s+(.+)/m);
  if (match) return match[1].trim().slice(0, 80);
  const firstLine = content.split("\n")[0].replace(/[#*_`]/g, "").trim();
  return firstLine.slice(0, 60) || "Untitled";
}

export function SaveToDocModal({ content, onClose }: SaveToDocModalProps) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState(() => extractTitle(content));
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { documents?: DocItem[] } | null) => {
        if (d?.documents) setDocs(d.documents);
      })
      .catch(() => null);
  }, []);

  const filteredDocs = docs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (mode === "new") {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() || "Untitled", content }),
        });
        if (!res.ok) throw new Error("Failed to create document");
      } else {
        if (!selectedDocId) {
          setError("Select a document first");
          setIsSaving(false);
          return;
        }
        const getRes = await fetch(`/api/documents/${selectedDocId}`);
        const getData = (await getRes.json()) as { document?: { content?: string } };
        const existingContent = getData.document?.content ?? "";
        const separator = existingContent.trim() ? "\n\n---\n\n" : "";
        const newContent = existingContent + separator + content;
        const res = await fetch(`/api/documents/${selectedDocId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newContent }),
        });
        if (!res.ok) throw new Error("Failed to update document");
      }
      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Save to Docs
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === "new"
                ? "border-b-2 border-teal-500 text-teal-600 dark:text-teal-400"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
            onClick={() => setMode("new")}
          >
            New document
          </button>
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === "existing"
                ? "border-b-2 border-teal-500 text-teal-600 dark:text-teal-400"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
            onClick={() => setMode("existing")}
          >
            Add to existing
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {mode === "new" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Document title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="Document title"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  autoFocus
                />
              </div>
              <div className="max-h-52 space-y-0.5 overflow-y-auto">
                {filteredDocs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-zinc-400">No documents found</p>
                ) : (
                  filteredDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        selectedDocId === doc.id
                          ? "bg-teal-50 dark:bg-teal-950/30"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <FileText
                        className={`h-3.5 w-3.5 shrink-0 ${
                          selectedDocId === doc.id ? "text-teal-500" : "text-zinc-400"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${
                            selectedDocId === doc.id
                              ? "text-teal-700 dark:text-teal-300"
                              : "text-zinc-900 dark:text-zinc-100"
                          }`}
                        >
                          {doc.title}
                        </p>
                        {doc.folder && (
                          <p className="truncate text-xs text-zinc-400">{doc.folder}</p>
                        )}
                      </div>
                      {selectedDocId === doc.id && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={isSaving || saved || (mode === "existing" && !selectedDocId)}
            className="gradient-brand border-0 text-white shadow-md shadow-teal-500/20"
          >
            {saved ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Saved
              </>
            ) : isSaving ? (
              "Saving…"
            ) : mode === "new" ? (
              <>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Create document
              </>
            ) : (
              "Append to document"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
