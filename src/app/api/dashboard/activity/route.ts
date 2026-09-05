import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { AgentRun } from "@/lib/types/database";

/** Space summary attached to each run so Activity can show and filter by Space. */
type RunProject = { id: string; name: string; emoji: string | null; color: string | null };

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit") || 50) || 50, 1), 100);
    const offset = Math.max(Number(params.get("offset") || 0) || 0, 0);
    const statusFilter = params.get("status");
    const projectFilter = params.get("project"); // a project id, or "general", or null

    const buildQuery = (select: string, opts?: { count?: "exact"; head?: boolean }) => {
      let q = supabase
        .from("agent_runs")
        .select(select, opts)
        .eq("user_id", user.id);
      if (statusFilter && statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      if (projectFilter === "general") {
        q = q.is("metadata->>project_id", null);
      } else if (projectFilter) {
        q = q.eq("metadata->>project_id", projectFilter);
      }
      return q;
    };

    const [{ data: runs, error }, { count, error: countError }] = await Promise.all([
      buildQuery("*")
        .order("started_at", { ascending: false })
        .range(offset, offset + limit - 1),
      buildQuery("id", { count: "exact", head: true }),
    ]);

    if (error || countError) {
      return NextResponse.json(
        { error: error?.message || countError?.message || "Failed to load activity" },
        { status: 500 },
      );
    }

    const runRows = (runs || []) as unknown as AgentRun[];

    // Attach the Space each run belongs to (from metadata.project_id), for a
    // scope badge and to link back into the right Space's chat.
    const projectIds = new Set<string>();
    for (const run of runRows) {
      const pid = (run.metadata as { project_id?: unknown } | null)?.project_id;
      if (typeof pid === "string") projectIds.add(pid);
    }

    let projectMap = new Map<string, RunProject>();
    if (projectIds.size > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, emoji, color")
        .eq("user_id", user.id)
        .in("id", [...projectIds]);
      projectMap = new Map(
        (projects ?? []).map((p) => [
          p.id as string,
          { id: p.id as string, name: p.name as string, emoji: p.emoji as string | null, color: p.color as string | null },
        ]),
      );
    }

    const enriched = runRows.map((run) => {
      const pid = (run.metadata as { project_id?: unknown } | null)?.project_id;
      const project = typeof pid === "string" ? projectMap.get(pid) ?? null : null;
      return { ...run, project };
    });

    return NextResponse.json(
      { runs: enriched, total: count || 0, limit, offset },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Dashboard activity API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
