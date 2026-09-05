import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { executeWorkflow, WorkflowBusyError } from "@/lib/workflows/execute-workflow";
import type { ScheduledTask } from "@/lib/types/database";

export const maxDuration = 300;

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
      .select("*")
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

    const result = await executeWorkflow(createAdminClient(), task as ScheduledTask, "manual");
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    if (error instanceof WorkflowBusyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Dashboard task run API error:", error);
    return NextResponse.json({ error: "Could not start the workflow. Check service status and try again." }, { status: 500 });
  }
}
