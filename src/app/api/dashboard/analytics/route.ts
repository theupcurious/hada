import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type AgentRunRow = {
  started_at: string;
  duration_ms: number | null;
  status: "running" | "completed" | "failed" | "timeout";
  tool_calls: unknown;
};

type ToolUsageStat = {
  name: string;
  count: number;
  avgDurationMs: number;
  errorRate: number;
  lastUsed: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const days = clamp(Number(request.nextUrl.searchParams.get("days") || 7) || 7, 1, 30);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    since.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("agent_runs")
      .select("started_at, duration_ms, status, tool_calls")
      .eq("user_id", user.id)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load analytics" },
        { status: 500 },
      );
    }

    const runs = (data || []) as AgentRunRow[];
    const dailyActivity = buildDailyActivity(days, runs);
    const toolUsage = buildToolUsage(runs);

    const durations = runs
      .map((run) => run.duration_ms)
      .filter((duration): duration is number => typeof duration === "number" && Number.isFinite(duration));
    const totalRuns = runs.length;
    const completedRuns = runs.filter((run) => run.status === "completed").length;
    const avgDurationMs = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0;

    return NextResponse.json({
      totalRuns,
      completedRuns,
      failedRuns: runs.filter((run) => run.status === "failed").length,
      timeoutRuns: runs.filter((run) => run.status === "timeout").length,
      successRate: totalRuns ? Math.round((completedRuns / totalRuns) * 100) : 0,
      avgDurationMs,
      mostUsedTool: toolUsage[0]?.name || "",
      toolUsage,
      dailyActivity,
      days,
    });
  } catch (error) {
    console.error("Dashboard analytics API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildDailyActivity(days: number, runs: AgentRunRow[]) {
  const byDate = new Map<string, number>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    byDate.set(date.toISOString().slice(0, 10), 0);
  }

  for (const run of runs) {
    const dateKey = run.started_at.slice(0, 10);
    byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1);
  }

  return Array.from(byDate.entries()).map(([date, runsCount]) => ({
    date,
    runs: runsCount,
  }));
}

function buildToolUsage(runs: AgentRunRow[]): ToolUsageStat[] {
  const stats = new Map<
    string,
    { count: number; durationTotal: number; errorCount: number; lastUsed: string | null }
  >();

  for (const run of runs) {
    const toolCalls = Array.isArray(run.tool_calls) ? run.tool_calls : [];
    for (const call of toolCalls) {
      const entry = call && typeof call === "object" ? (call as Record<string, unknown>) : {};
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (!name) {
        continue;
      }

      const durationMs =
        typeof entry.durationMs === "number" && Number.isFinite(entry.durationMs)
          ? entry.durationMs
          : 0;
      const isError = entry.status === "error";

      const current = stats.get(name) || {
        count: 0,
        durationTotal: 0,
        errorCount: 0,
        lastUsed: null,
      };

      current.count += 1;
      current.durationTotal += durationMs;
      current.errorCount += isError ? 1 : 0;
      current.lastUsed = run.started_at;
      stats.set(name, current);
    }
  }

  return Array.from(stats.entries())
    .map(([name, stat]) => ({
      name,
      count: stat.count,
      avgDurationMs: stat.count ? Math.round(stat.durationTotal / stat.count) : 0,
      errorRate: stat.count ? Math.round((stat.errorCount / stat.count) * 100) : 0,
      lastUsed: stat.lastUsed,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}
