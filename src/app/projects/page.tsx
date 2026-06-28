"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderKanban, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types/database";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [toDelete, setToDelete] = useState<Project | null>(null);

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

  const createProject = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to create project");
      setName("");
      setDescription("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
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
              Projects
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              A workspace that bundles its documents, chat, and outputs in one place.
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
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name (e.g. Acme Launch)"
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
            placeholder="What is this project about? (optional — the assistant uses this as context)"
            rows={3}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="brand"
              className="rounded-xl"
              onClick={() => void createProject()}
              disabled={creating || !name.trim()}
            >
              {creating ? "Creating…" : "Create project"}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No projects yet.</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Create one to group a piece of work — its docs, chat, and outputs stay together.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className={cn(
                "group flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 transition-colors hover:border-teal-500/40 dark:border-zinc-800 dark:bg-zinc-950/50",
                project.archived && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {project.name}
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
                  aria-label="Delete project"
                  className="h-8 w-8 text-zinc-400 hover:text-red-500"
                  onClick={() => setToDelete(project)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description="This removes the project. Its documents and chat history are not deleted."
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
