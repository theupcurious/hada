import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/chat/process-message";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTelegramToUser } from "@/lib/telegram/send";
import type { ScheduledTask } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (configuredSecret) {
    const headerSecret = request.headers.get("x-cron-secret") || "";
    if (headerSecret !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: onceTasks, error: onceError } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("enabled", true)
    .eq("type", "once")
    .lte("run_at", now.toISOString());

  if (onceError) {
    console.error("Failed to load one-time tasks", onceError);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }

  const { data: recurringTasks, error: recurringError } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("enabled", true)
    .eq("type", "recurring");

  if (recurringError) {
    console.error("Failed to load recurring tasks", recurringError);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }

  const dueRecurring = ((recurringTasks || []) as ScheduledTask[]).filter((task) => {
    if (!task.cron_expression) {
      return false;
    }

    if (!cronMatches(task.cron_expression, now)) {
      return false;
    }

    if (!task.last_run_at) {
      return true;
    }

    const lastRun = new Date(task.last_run_at);
    return !isSameMinute(lastRun, now);
  });

  const dueTasks: ScheduledTask[] = [...((onceTasks || []) as ScheduledTask[]), ...dueRecurring];
  let processed = 0;

  for (const task of dueTasks) {
    try {
      const result = await processMessage({
        userId: task.user_id,
        message: task.description,
        source: "scheduled",
        supabase,
      });

      await sendTelegramToUser({
        supabase,
        userId: task.user_id,
        text: result.response,
      });

      const updates: Record<string, unknown> = {
        last_run_at: now.toISOString(),
      };

      if (task.type === "once") {
        updates.enabled = false;
      }

      await supabase
        .from("scheduled_tasks")
        .update(updates)
        .eq("id", task.id);

      processed += 1;
    } catch (error) {
      console.error("Scheduled task failed", task.id, error);
    }
  }

  return NextResponse.json({ ok: true, processed, due: dueTasks.length, timestamp: now.toISOString() });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

function isSameMinute(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate() &&
    a.getUTCHours() === b.getUTCHours() &&
    a.getUTCMinutes() === b.getUTCMinutes()
  );
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
