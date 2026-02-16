import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";

export function createScheduleTaskTool(context: ToolContext): AgentTool {
  return {
    name: "schedule_task",
    description:
      "Create one-time or recurring scheduled tasks for reminders/briefings/follow-ups.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["once", "recurring"],
          description: "Task type: once for a single run, recurring for cron-based repetition.",
        },
        description: {
          type: "string",
          description: "What the scheduled run should ask Hada to do.",
        },
        run_at: {
          type: "string",
          description: "ISO datetime for one-time tasks.",
        },
        cron_expression: {
          type: "string",
          description: "Cron expression for recurring tasks (5 fields).",
        },
      },
      required: ["type", "description"],
    },
    async execute(args) {
      const type = String(args.type || "").trim();
      const description = String(args.description || "").trim();
      const runAt = typeof args.run_at === "string" ? args.run_at : null;
      const cronExpression =
        typeof args.cron_expression === "string" ? args.cron_expression.trim() : null;

      if (!description) {
        return JSON.stringify({ success: false, error: "description is required" });
      }

      if (type !== "once" && type !== "recurring") {
        return JSON.stringify({ success: false, error: "type must be once or recurring" });
      }

      if (type === "once" && !runAt) {
        return JSON.stringify({ success: false, error: "run_at is required for once tasks" });
      }

      if (type === "recurring" && !cronExpression) {
        return JSON.stringify({ success: false, error: "cron_expression is required for recurring tasks" });
      }

      const { data, error } = await context.supabase
        .from("scheduled_tasks")
        .insert({
          user_id: context.userId,
          type,
          description,
          run_at: type === "once" ? runAt : null,
          cron_expression: type === "recurring" ? cronExpression : null,
          enabled: true,
        })
        .select("id, type, description, run_at, cron_expression, enabled")
        .single();

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      return JSON.stringify({ success: true, task: data });
    },
  };
}
