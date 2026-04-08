import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .select("id, description, enabled, type, run_at, cron_expression")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load task" },
        { status: 500 },
      );
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: false,
        supported: false,
        task,
        message:
          "Immediate execution is not wired through the dashboard API. Use the existing cron pipeline or chat-triggered scheduling instead.",
      },
      { status: 501 },
    );
  } catch (error) {
    console.error("Dashboard task run API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
