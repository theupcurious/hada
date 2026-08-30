import type { SupabaseClient } from "@supabase/supabase-js";
import type { Document, Project } from "@/lib/types/database";

/** Derive a stable folder name from a project name. */
export function projectFolder(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80) || "Untitled Project";
}

/** Clean a suggestions list: trim, drop blanks, cap length. NULL when empty. */
function normalizeSuggestions(
  suggestions: string[] | null | undefined,
): string[] | null {
  if (!Array.isArray(suggestions)) return null;
  const cleaned = suggestions
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Clean a tool allowlist. Unlike suggestions, an empty array is meaningful
 * ("no gateable tools") and preserved — only null/undefined/non-array collapse
 * to NULL (unrestricted). Trims, drops blanks, de-dupes.
 */
function normalizeToolAllowlist(
  allowlist: string[] | null | undefined,
): string[] | null {
  if (allowlist === null || allowlist === undefined) return null;
  if (!Array.isArray(allowlist)) return null;
  const cleaned = allowlist
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

export async function listProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list projects: ${error.message}`);
  return (data as Project[]) ?? [];
}

export async function getProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load project: ${error.message}`);
  return (data as Project | null) ?? null;
}

export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string;
    description?: string | null;
    instructions?: string | null;
    emoji?: string | null;
    color?: string | null;
    suggestions?: string[] | null;
    toolAllowlist?: string[] | null;
  },
): Promise<Project> {
  const name = input.name.trim();
  // Only include tool_allowlist when the caller actually set it, so creation
  // still works if migration 021 hasn't been applied yet (the column is absent).
  const allowlistPatch =
    input.toolAllowlist !== undefined
      ? { tool_allowlist: normalizeToolAllowlist(input.toolAllowlist) }
      : {};
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name,
      folder: projectFolder(name),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      emoji: input.emoji?.trim() || null,
      color: input.color?.trim() || null,
      suggestions: normalizeSuggestions(input.suggestions),
      ...allowlistPatch,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data as Project;
}

export async function updateProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  updates: {
    name?: string;
    description?: string | null;
    instructions?: string | null;
    emoji?: string | null;
    color?: string | null;
    suggestions?: string[] | null;
    toolAllowlist?: string[] | null;
    archived?: boolean;
  },
): Promise<Project | null> {
  const patch: Record<string, unknown> = {};
  if (typeof updates.name === "string" && updates.name.trim()) {
    patch.name = updates.name.trim();
    patch.folder = projectFolder(updates.name);
  }
  if (updates.description !== undefined) {
    patch.description = updates.description?.trim() || null;
  }
  if (updates.instructions !== undefined) {
    patch.instructions = updates.instructions?.trim() || null;
  }
  if (updates.emoji !== undefined) {
    patch.emoji = updates.emoji?.trim() || null;
  }
  if (updates.color !== undefined) {
    patch.color = updates.color?.trim() || null;
  }
  if (updates.suggestions !== undefined) {
    patch.suggestions = normalizeSuggestions(updates.suggestions);
  }
  if (updates.toolAllowlist !== undefined) {
    // normalize preserves [] (no gateable tools) and maps null → NULL (unrestricted).
    patch.tool_allowlist = normalizeToolAllowlist(updates.toolAllowlist);
  }
  if (typeof updates.archived === "boolean") {
    patch.archived = updates.archived;
  }
  if (Object.keys(patch).length === 0) {
    return getProject(supabase, userId, projectId);
  }

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to update project: ${error.message}`);
  return (data as Project | null) ?? null;
}

export async function deleteProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Failed to delete project: ${error.message}`);
  return Boolean(data);
}

/**
 * Fetch just a space's tool allowlist for the agent loop. Returns NULL
 * (unrestricted) when the space has none, isn't found, or — importantly — when
 * the `tool_allowlist` column doesn't exist yet (migration 021 not applied), so
 * chat never breaks over a missing column. Only a non-null array restricts.
 */
export async function getProjectToolAllowlist(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("tool_allowlist")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // Missing column / transient error → degrade to unrestricted, never throw.
    return null;
  }
  const value = (data as { tool_allowlist?: string[] | null } | null)?.tool_allowlist;
  return Array.isArray(value) ? value : null;
}

/** Documents bound to a project (folder match). */
export async function getProjectDocuments(
  supabase: SupabaseClient,
  userId: string,
  folder: string,
): Promise<Pick<Document, "id" | "title" | "updated_at">[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .eq("folder", folder)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load project documents: ${error.message}`);
  return (data as Pick<Document, "id" | "title" | "updated_at">[]) ?? [];
}
