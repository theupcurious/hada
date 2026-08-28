"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderKanban, MessageSquare, Plus, Sliders, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types/database";
import { SPACE_TEMPLATES } from "@/lib/space-templates";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [toDelete, setToDelete] = useState<Project | null>(null);

  // Inline per-space editor (description + instructions only — editing the name
  // would re-derive the folder and orphan the space's documents).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load projects");
      const data = (await res.json()) as { projects?: Project[] };
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Arrive here from the "New space" action with the create form already open,
  // so the starter templates are the first thing you see.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setShowForm(true);
    }
  }, []);

  const createProject = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          instructions: instructions.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to create project");
      setName("");
      setDescription("");
      setInstructions("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const applyTemplate = (template: (typeof SPACE_TEMPLATES)[number]) => {
    setName(template.name);
    setDescription(template.description);
    setInstructions(template.instructions);
  };

  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditDescription(project.description ?? "");
    setEditInstructions(project.instructions ?? "");
  };

  const saveEditing = async (project: Project) => {
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescription.trim(),
          instructions: editInstructions.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as { project?: Project; error?: string } | null;
      if (!res.ok || !data?.project) throw new Error(data?.error || "Failed to save space");
      setProjects((prev) => prev.map((p) => (p.id === project.id ? data.project! : p)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save space");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteProject = async (project: Project) => {
    setToDelete(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
      } else {
        setError("Failed to delete project");
      }
    } catch {
      setError("Failed to delete project");
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/chat">
            <Button variant="ghost" size="icon" aria-label="Back to chat" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              <FolderKanban className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Spaces
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              A dedicated assistant for a topic — its own instructions, chat, and memory.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm" variant="brand" className="rounded-xl">
          <Plus className="mr-1.5 h-4 w-4" />
          New
        </Button>
      </div>

      {showForm ? (
        <div className="mb-6 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Start from a template
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SPACE_TEMPLATES.map((template) => {
                const active = template.name
                  ? name === template.name && instructions === template.instructions
                  : false;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors",
                      active
                        ? "border-teal-500/60 bg-teal-500/5"
                        : "border-zinc-200 bg-white hover:border-teal-500/50 dark:border-zinc-700 dark:bg-zinc-950",
                    )}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {template.icon}
                    </span>
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-100">
                      {template.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Space name (e.g. Investing)"
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void createProject();
              }
            }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this space about? (optional — the assistant uses this as context)"
            rows={2}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Instructions — the space's role and style (e.g. 'You are a markets analyst. Be terse, always cite a source.')"
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <p className="mt-1 px-1 text-xs text-zinc-400 dark:text-zinc-500">
              The assistant follows these for every message in this space.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="brand"
              className="rounded-xl"
              onClick={() => void createProject()}
              disabled={creating || !name.trim()}
            >
              {creating ? "Creating…" : "Create space"}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading spaces…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No spaces yet.</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Create one to give the assistant a dedicated role — its chat and memory stay separate.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className={cn(
                "group rounded-2xl border border-zinc-200 bg-white/80 p-4 transition-colors hover:border-teal-500/40 dark:border-zinc-800 dark:bg-zinc-950/50",
                project.archived && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {project.name}
                    {project.instructions?.trim() ? (
                      <span
                        className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-400"
                        title="This space has custom instructions"
                      >
                        Custom
                      </span>
                    ) : null}
                  </h2>
                  {project.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {project.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => router.push(`/chat?project=${project.id}`)}
                  >
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    Open in chat
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Customize space"
                    className={cn(
                      "h-8 w-8 text-zinc-400 hover:text-teal-600",
                      editingId === project.id && "text-teal-600",
                    )}
                    onClick={() =>
                      editingId === project.id ? setEditingId(null) : startEditing(project)
                    }
                  >
                    <Sliders className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete space"
                    className="h-8 w-8 text-zinc-400 hover:text-red-500"
                    onClick={() => setToDelete(project)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {editingId === project.id ? (
                <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="What is this space about?"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Instructions
                  </label>
                  <textarea
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="The space's role and style — the assistant follows these every message."
                    rows={4}
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="brand"
                      className="rounded-xl"
                      disabled={savingEdit}
                      onClick={() => void saveEditing(project)}
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description="This removes the space. Its documents and chat history are not deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onOpenChange={(open) => !open && setToDelete(null)}
        onConfirm={() => {
          if (toDelete) return deleteProject(toDelete);
        }}
      />
    </div>
  );
}
