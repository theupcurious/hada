import type { SupabaseClient } from "@supabase/supabase-js";
import type { Document, Project } from "@/lib/types/database";

/** Derive a stable folder name from a project name. */
export function projectFolder(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80) || "Untitled Project";
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
  input: { name: string; description?: string | null },
): Promise<Project> {
  const name = input.name.trim();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name,
      folder: projectFolder(name),
      description: input.description?.trim() || null,
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
  updates: { name?: string; description?: string | null; archived?: boolean },
): Promise<Project | null> {
  const patch: Record<string, unknown> = {};
  if (typeof updates.name === "string" && updates.name.trim()) {
    patch.name = updates.name.trim();
    patch.folder = projectFolder(updates.name);
  }
  if (updates.description !== undefined) {
    patch.description = updates.description?.trim() || null;
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
