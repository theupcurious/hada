import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";

import type { ToolManifest } from "@/lib/chat/tools/tool-registry";

export const scheduleTaskManifest: ToolManifest = {
  name: "schedule_task",
  displayName: "Schedule Task",
  description: "Create one-time or recurring scheduled tasks for reminders/briefings/follow-ups.",
  category: "system",
  riskLevel: "medium",
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
};

export function createScheduleTaskTool(context: ToolContext): AgentTool {
  return {
    name: scheduleTaskManifest.name,
    description: scheduleTaskManifest.description,
    parameters: scheduleTaskManifest.parameters,
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

      // Tag the task with the current Space so it later runs as that assistant.
      // Only include the column when in a Space, so General scheduling still
      // works before migration 022 adds the column.
      const projectPatch = context.projectId ? { project_id: context.projectId } : {};
      const { data, error } = await context.supabase
        .from("scheduled_tasks")
        .insert({
          user_id: context.userId,
          type,
          description,
          run_at: type === "once" ? runAt : null,
          cron_expression: type === "recurring" ? cronExpression : null,
          enabled: true,
          ...projectPatch,
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
