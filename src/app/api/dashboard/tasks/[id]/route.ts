import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (typeof body?.enabled === "boolean") {
      updates.enabled = body.enabled;
    }

    if (typeof body?.description === "string" && body.description.trim()) {
      updates.description = body.description.trim();
    }

    if (typeof body?.type === "string" && (body.type === "once" || body.type === "recurring")) {
      updates.type = body.type;
    }

    if (typeof body?.run_at === "string") {
      updates.run_at = body.run_at;
    }

    if (typeof body?.cron_expression === "string") {
      updates.cron_expression = body.cron_expression.trim();
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("scheduled_tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update task" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    console.error("Dashboard task update API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("scheduled_tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete task" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Dashboard task delete API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
