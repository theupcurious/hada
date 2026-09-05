import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { AgentRun } from "@/lib/types/database";

/**
 * GET /api/dashboard/tasks/[id]/runs
 * Recent runs for one workflow — the agent runs tagged with this scheduled
 * task's id in their metadata (recorded by executeWorkflow → processMessage).
 */
export async function GET(
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

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 10) || 10, 1), 50);

    const { data, error } = await supabase
      .from("agent_runs")
      .select("id, status, started_at, finished_at, duration_ms, output_preview, error, tool_calls")
      .eq("user_id", user.id)
      .eq("metadata->>scheduled_task_id", id)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load runs" }, { status: 500 });
    }

    return NextResponse.json(
      { runs: (data || []) as Partial<AgentRun>[] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Workflow runs API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
