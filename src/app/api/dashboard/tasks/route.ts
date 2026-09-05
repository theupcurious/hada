import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type TaskRow = {
  id: string;
  type: "once" | "recurring";
  cron_expression: string | null;
  run_at: string | null;
  description: string;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load tasks" },
        { status: 500 },
      );
    }

    const now = new Date();
    const tasks = (data || []).map((task) => {
      const row = task as TaskRow;
      return {
        ...row,
        next_run_at: estimateNextRunAt(row, now),
      };
    });

    const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const filtered = query
      ? tasks.filter((task) => {
          const description = String(task.description || "").toLowerCase();
          const type = String(task.type || "").toLowerCase();
          const cron = String(task.cron_expression || "").toLowerCase();
          return description.includes(query) || type.includes(query) || cron.includes(query);
        })
      : tasks;

    return NextResponse.json({
      tasks: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error("Dashboard tasks API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const type = body?.type === "once" ? "once" : "recurring";
    const cronExpression =
      typeof body?.cron_expression === "string" ? body.cron_expression.trim() : "";
    const runAt = typeof body?.run_at === "string" ? body.run_at : "";
    const projectId = typeof body?.project_id === "string" && body.project_id.trim() ? body.project_id.trim() : null;

    if (!description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (type === "recurring" && !isValidCron(cronExpression)) {
      return NextResponse.json({ error: "A valid 5-field cron_expression is required" }, { status: 400 });
    }
    if (type === "once" && !runAt) {
      return NextResponse.json({ error: "run_at is required for one-time tasks" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("scheduled_tasks")
      .insert({
        user_id: user.id,
        type,
        description,
        run_at: type === "once" ? runAt : null,
        cron_expression: type === "recurring" ? cronExpression : null,
        enabled: true,
        // Space this workflow runs in (migration 022). Only set when chosen, so
        // General workflows insert cleanly. NULL = General.
        ...(projectId ? { project_id: projectId } : {}),
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create task" },
        { status: 500 },
      );
    }

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) {
    console.error("Dashboard task create API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  return parts.length === 5 && parts.every((p) => /^[\d*,/-]+$/.test(p));
}

function estimateNextRunAt(task: TaskRow, now: Date): string | null {
  if (!task.enabled) {
    return null;
  }

  if (task.type === "once") {
    if (!task.run_at) {
      return null;
    }

    const runAt = new Date(task.run_at);
    return runAt > now ? runAt.toISOString() : null;
  }

  if (!task.cron_expression) {
    return null;
  }

  return findNextCronMatch(task.cron_expression, now);
}

function findNextCronMatch(cron: string, start: Date): string | null {
  const current = new Date(start);
  current.setUTCSeconds(0, 0);
  current.setUTCMinutes(current.getUTCMinutes() + 1);

  const maxChecks = 60 * 24 * 90;
  for (let i = 0; i < maxChecks; i += 1) {
    if (cronMatches(cron, current)) {
      return current.toISOString();
    }
    current.setUTCMinutes(current.getUTCMinutes() + 1);
  }

  return null;
}

function cronMatches(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour, day, month, weekday] = parts;
  return (
    matchCronField(minute, date.getUTCMinutes()) &&
    matchCronField(hour, date.getUTCHours()) &&
    matchCronField(day, date.getUTCDate()) &&
    matchCronField(month, date.getUTCMonth() + 1) &&
    matchCronField(weekday, date.getUTCDay())
  );
}

function matchCronField(field: string, value: number): boolean {
  if (field === "*") {
    return true;
  }

  if (field.includes(",")) {
    return field.split(",").some((entry) => matchCronField(entry.trim(), value));
  }

  if (field.includes("/")) {
    const [base, stepText] = field.split("/");
    const step = Number(stepText);
    if (!Number.isFinite(step) || step <= 0) {
      return false;
    }

    if (base === "*") {
      return value % step === 0;
    }

    const baseNumber = Number(base);
    if (!Number.isFinite(baseNumber)) {
      return false;
    }

    return value >= baseNumber && (value - baseNumber) % step === 0;
  }

  const exact = Number(field);
  return Number.isFinite(exact) && exact === value;
}
