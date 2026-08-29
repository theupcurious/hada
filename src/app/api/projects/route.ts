import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createProject, listProjects } from "@/lib/db/projects";

export async function GET() {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listProjects(supabase, user.id);
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description : null;
  const instructions = typeof body?.instructions === "string" ? body.instructions : null;
  const emoji = typeof body?.emoji === "string" ? body.emoji : null;
  const color = typeof body?.color === "string" ? body.color : null;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const project = await createProject(supabase, user.id, {
      name,
      description,
      instructions,
      emoji,
      color,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    // Surface the duplicate-folder unique constraint as a friendly 409.
    const status = /duplicate key|unique/i.test(message) ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "A project with that name already exists." : message },
      { status },
    );
  }
}
