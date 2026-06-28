import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { processMessage } from "@/lib/chat/process-message";
import { sendTelegramToUser } from "@/lib/telegram/send";

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

    // Execute the workflow now, mirroring the scheduled (cron) pipeline: run the
    // task prompt through the agent, deliver to Telegram if linked, and stamp
    // last_run_at. The assistant reply is also persisted to the user's chat.
    const admin = createAdminClient();
    const result = await processMessage({
      userId: user.id,
      message: task.description,
      source: "scheduled",
      supabase: admin,
    });

    await sendTelegramToUser({
      supabase: admin,
      userId: user.id,
      text: result.response,
    }).catch((err) => console.error("Run-now Telegram delivery failed", err));

    await admin
      .from("scheduled_tasks")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: "Workflow ran — the result is in your chat (and Telegram if connected).",
      response: result.response,
    });
  } catch (error) {
    console.error("Dashboard task run API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
