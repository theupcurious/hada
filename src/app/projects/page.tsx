"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderKanban, MessageSquare, Plus, Sliders, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types/database";
import { SPACE_TEMPLATES, SPACE_COLORS, SPACE_EMOJIS } from "@/lib/space-templates";
import { ALWAYS_ON_TOOL_NAMES } from "@/lib/chat/tools/tool-registry";

/** A tool the space allowlist can restrict (from /api/tools, minus always-on core). */
interface GateableTool {
  name: string;
  displayName: string;
  description: string;
  category: string;
  requiresIntegration?: string;
  isConnected: boolean;
}

/** Friendly section labels for the tool categories shown in the picker. */
const TOOL_CATEGORY_LABELS: Record<string, string> = {
  web: "Web",
  communication: "Email",
  calendar: "Calendar",
  documents: "Documents",
  custom: "Connectors",
  system: "System",
};

/** Order-insensitive equality for two allowlists (null = unrestricted). */
function allowlistEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((name) => set.has(name));
}

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
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[0]);
  // Starter prompts prefilled from a template; not directly edited in the form.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // null = unrestricted (all tools); array = only those gateable tools.
  const [toolAllowlist, setToolAllowlist] = useState<string[] | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [toolCatalog, setToolCatalog] = useState<GateableTool[]>([]);

  // Inline per-space editor (description + instructions only — editing the name
  // would re-derive the folder and orphan the space's documents).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editColor, setEditColor] = useState(SPACE_COLORS[0]);
  const [editSuggestions, setEditSuggestions] = useState<string[]>([]);
  const [editToolAllowlist, setEditToolAllowlist] = useState<string[] | null>(null);
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

  // Fetch the gateable tool catalog once for the allowlist pickers. Core
  // always-on tools are filtered out — they can't be restricted.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tools");
        if (!res.ok) return;
        const data = (await res.json()) as { tools?: GateableTool[] };
        if (cancelled) return;
        setToolCatalog(
          (data.tools ?? []).filter((t) => !ALWAYS_ON_TOOL_NAMES.has(t.name)),
        );
      } catch {
        // Non-fatal: the picker simply shows nothing to limit.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          emoji: emoji.trim() || null,
          color: color || null,
          suggestions: suggestions.length > 0 ? suggestions : null,
          // Only send when restricting, so unrestricted creation still works
          // before migration 021 is applied (the column may not exist).
          ...(toolAllowlist !== null ? { tool_allowlist: toolAllowlist } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to create project");
      setName("");
      setDescription("");
      setInstructions("");
      setEmoji("");
      setColor(SPACE_COLORS[0]);
      setSuggestions([]);
      setToolAllowlist(null);
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
    // The blank template's "＋" is a UI marker, not a real space emoji.
    setEmoji(template.name ? template.icon : "");
    setColor(template.color);
    setSuggestions(template.suggestions);
  };

  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditDescription(project.description ?? "");
    setEditInstructions(project.instructions ?? "");
    setEditEmoji(project.emoji ?? "");
    setEditColor(project.color || SPACE_COLORS[0]);
    setEditSuggestions(Array.isArray(project.suggestions) ? project.suggestions : []);
    setEditToolAllowlist(project.tool_allowlist ?? null);
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
          emoji: editEmoji.trim(),
          color: editColor,
          suggestions: editSuggestions,
          // Send the allowlist only when it actually changed, so editing other
          // fields doesn't touch the column (keeps pre-021 edits working). null
          // is sent when cleared, so "Limit tools" can be turned back off.
          ...(allowlistEqual(editToolAllowlist, project.tool_allowlist ?? null)
            ? {}
            : { tool_allowlist: editToolAllowlist }),
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
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Icon &amp; color
            </p>
            <IdentityPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
          </div>
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
          <SuggestionsEditor value={suggestions} onChange={setSuggestions} />
          <ToolAllowlistPicker
            catalog={toolCatalog}
            value={toolAllowlist}
            onChange={setToolAllowlist}
          />
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
                    <SpaceIdentity emoji={project.emoji} color={project.color} />
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
                    Icon &amp; color
                  </label>
                  <IdentityPicker
                    emoji={editEmoji}
                    color={editColor}
                    onEmoji={setEditEmoji}
                    onColor={setEditColor}
                  />
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
                  <SuggestionsEditor value={editSuggestions} onChange={setEditSuggestions} />
                  <ToolAllowlistPicker
                    catalog={toolCatalog}
                    value={editToolAllowlist}
                    onChange={setEditToolAllowlist}
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

/** The space's emoji if set, otherwise a colored dot from its accent color. */
function SpaceIdentity({ emoji, color }: { emoji: string | null; color: string | null }) {
  if (emoji?.trim()) {
    return (
      <span className="shrink-0 text-sm leading-none" aria-hidden>
        {emoji}
      </span>
    );
  }
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color || SPACE_COLORS[0] }}
    />
  );
}

/**
 * Editor for a Space's starter prompts. These become the tap-to-send cards on
 * the Space's home and the chips above the composer; without them a Space falls
 * back to the General starters, which read wrong in a specialized Space. Up to 6.
 */
function SuggestionsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const MAX = 6;
  const update = (index: number, text: string) =>
    onChange(value.map((s, i) => (i === index ? text : s)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => {
    if (value.length < MAX) onChange([...value, ""]);
  };

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Starter prompts</p>
      <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
        Tap-to-send shortcuts on this space&apos;s home and above the composer. Up to {MAX}.
      </p>
      {value.length > 0 ? (
        <div className="space-y-1.5">
          {value.map((prompt, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={prompt}
                onChange={(e) => update(index, e.target.value)}
                placeholder="e.g. Summarize today's market news"
                className="rounded-lg"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove starter"
                className="h-8 w-8 shrink-0 text-zinc-400 hover:text-red-500"
                onClick={() => remove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {value.length < MAX ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 rounded-lg"
          onClick={add}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add starter
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Per-space tool allowlist picker. Off by default (unrestricted — all tools,
 * value `null`). Turning "Limit tools" on preselects every gateable tool, so
 * the common case is unchecking the few a space shouldn't use (e.g. Email).
 * An empty selection is valid and means "core essentials only".
 */
function ToolAllowlistPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: GateableTool[];
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const limited = value !== null;

  // Group the catalog by category, preserving a stable, sensible section order.
  const order = ["web", "communication", "calendar", "documents", "custom", "system"];
  const groups = order
    .map((cat) => ({ cat, tools: catalog.filter((t) => t.category === cat) }))
    .filter((g) => g.tools.length > 0);
  // Any categories not in `order` (future-proofing) go last.
  for (const t of catalog) {
    if (!order.includes(t.category) && !groups.some((g) => g.cat === t.category)) {
      groups.push({ cat: t.category, tools: catalog.filter((x) => x.category === t.category) });
    }
  }

  const selected = new Set(value ?? []);
  const toggleTool = (name: string) => {
    if (value === null) return;
    onChange(value.includes(name) ? value.filter((n) => n !== name) : [...value, name]);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
            Limit tools in this space
          </span>
          <span className="mt-0.5 block text-xs text-zinc-400 dark:text-zinc-500">
            {limited
              ? "Only the checked tools are available here. Memory and core tools always stay on."
              : "All tools are available. Turn on to restrict what this space can do."}
          </span>
        </span>
        <input
          type="checkbox"
          checked={limited}
          // On → preselect all gateable tools (uncheck to remove). Off → unrestricted.
          onChange={(e) => onChange(e.target.checked ? catalog.map((t) => t.name) : null)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
        />
      </label>

      {limited ? (
        <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {groups.length === 0 ? (
            <p className="text-xs text-zinc-400">No optional tools available.</p>
          ) : (
            groups.map((group) => (
              <div key={group.cat}>
                <p className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {TOOL_CATEGORY_LABELS[group.cat] ?? group.cat}
                </p>
                <div className="space-y-1">
                  {group.tools.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(tool.name)}
                        onChange={() => toggleTool(tool.name)}
                        className="h-4 w-4 shrink-0 accent-teal-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          {tool.displayName}
                        </span>
                      </span>
                      {tool.requiresIntegration && !tool.isConnected ? (
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Not connected
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Emoji + accent color picker shared by the create form and the inline editor. */
function IdentityPicker({
  emoji,
  color,
  onEmoji,
  onColor,
}: {
  emoji: string;
  color: string;
  onEmoji: (value: string) => void;
  onColor: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {SPACE_EMOJIS.map((choice) => {
          const active = emoji === choice;
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={active}
              // Click a selected emoji again to clear it (fall back to a dot).
              onClick={() => onEmoji(active ? "" : choice)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-colors",
                active
                  ? "border-teal-500/60 bg-teal-500/10"
                  : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {SPACE_COLORS.map((choice) => {
          const active = color === choice;
          return (
            <button
              key={choice}
              type="button"
              aria-label={`Accent color ${choice}`}
              aria-pressed={active}
              onClick={() => onColor(choice)}
              className={cn(
                "h-6 w-6 rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-zinc-900",
                active ? "ring-2 ring-zinc-900 dark:ring-white" : "ring-0",
              )}
              style={{ backgroundColor: choice }}
            />
          );
        })}
      </div>
    </div>
  );
}
