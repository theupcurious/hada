import type { SupabaseClient } from "@supabase/supabase-js";
import { processMessage } from "@/lib/chat/process-message";
import { sendTelegramToUser } from "@/lib/telegram/send";
import type { ScheduledTask } from "@/lib/types/database";

export class WorkflowBusyError extends Error {
  constructor() { super("This workflow is already running or was just run. Refresh before trying again."); }
}

/** Both triggers use the same claim, Space context, delivery, and completion path. */
export async function executeWorkflow(supabase: SupabaseClient, task: ScheduledTask, trigger: "manual" | "cron") {
  const token = crypto.randomUUID();
  const { data: claimed, error: claimError } = await supabase.rpc("claim_workflow_execution", {
    task_id: task.id, owner_id: task.user_id, claim_token: token, expected_last_run: task.last_run_at,
  });
  if (claimError) throw new Error("Workflow execution is unavailable. Apply database migration 023 and try again.");
  if (!claimed) throw new WorkflowBusyError();

  try {
    const result = await processMessage({
      userId: task.user_id, message: task.description, source: "scheduled", supabase,
      projectId: task.project_id ?? undefined,
      scheduledTaskId: task.id,
    });
    const resultUrl = `/chat?${new URLSearchParams({
      ...(task.project_id ? { project: task.project_id } : {}),
      message: result.assistantMessageId,
    })}`;
    if (result.metadata.gatewayError) {
      return { success: false, error: "The workflow couldn’t finish. Open the result for details and recovery options.", resultUrl };
    }

    let warning: string | undefined;
    try {
      let prefix = "";
      if (task.project_id) {
        const { data: project } = await supabase.from("projects").select("name, emoji")
          .eq("id", task.project_id).eq("user_id", task.user_id).maybeSingle();
        if (project?.name) prefix = `${project.emoji?.trim() ? `${project.emoji.trim()} ` : ""}${project.name}\n\n`;
      }
      await sendTelegramToUser({ supabase, userId: task.user_id, text: `${prefix}${result.response}` });
    } catch {
      warning = "Saved in chat, but Telegram delivery failed.";
    }
    const { error } = await supabase.from("scheduled_tasks").update({
      last_run_at: new Date().toISOString(),
      ...(trigger === "cron" && task.type === "once" ? { enabled: false } : {}),
    }).eq("id", task.id).eq("execution_token", token);
    if (error) warning = "The result was saved, but the workflow’s last-run status could not be updated.";
    return { success: true, message: warning ?? "Workflow completed. Your result is ready in chat.", resultUrl };
  } finally {
    const { error } = await supabase.from("scheduled_tasks")
      .update({ execution_token: null, execution_started_at: null })
      .eq("id", task.id).eq("execution_token", token);
    if (error) console.error("Failed to release workflow claim", task.id, error);
  }
}
