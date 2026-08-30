import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  deleteProject,
  getProject,
  getProjectDocuments,
  updateProject,
} from "@/lib/db/projects";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const project = await getProject(supabase, user.id, id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [documents, segmentsResult] = await Promise.all([
      getProjectDocuments(supabase, user.id, project.folder),
      supabase
        .from("conversation_segments")
        .select("id, title, topic_key, status, message_count, last_active_at")
        .eq("user_id", user.id)
        .filter("metadata->>project_id", "eq", id)
        .order("last_active_at", { ascending: false }),
    ]);

    return NextResponse.json({
      project,
      documents,
      segments: segmentsResult.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load project" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const project = await updateProject(supabase, user.id, id, {
      name: typeof body?.name === "string" ? body.name : undefined,
      description: typeof body?.description === "string" ? body.description : undefined,
      instructions: typeof body?.instructions === "string" ? body.instructions : undefined,
      emoji: typeof body?.emoji === "string" ? body.emoji : undefined,
      color: typeof body?.color === "string" ? body.color : undefined,
      suggestions: Array.isArray(body?.suggestions)
        ? (body.suggestions as unknown[]).filter((s): s is string => typeof s === "string")
        : undefined,
      // null clears the allowlist (unrestricted); an array sets it; anything
      // else leaves it untouched. Must special-case null so "Limit tools" can
      // be turned back off — Array.isArray(null) is false.
      toolAllowlist:
        body?.tool_allowlist === null
          ? null
          : Array.isArray(body?.tool_allowlist)
            ? (body.tool_allowlist as unknown[]).filter((s): s is string => typeof s === "string")
            : undefined,
      archived: typeof body?.archived === "boolean" ? body.archived : undefined,
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteProject(supabase, user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status: 500 },
    );
  }
}
