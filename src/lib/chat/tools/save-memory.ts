import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";

export function createSaveMemoryTool(context: ToolContext): AgentTool {
  return {
    name: "save_memory",
    description:
      "Save or update long-term memory for this user under a concise topic key.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Short stable topic key, e.g. 'work-hours' or 'travel-preferences'.",
        },
        content: {
          type: "string",
          description: "Concise memory content to store.",
        },
      },
      required: ["topic", "content"],
    },
    async execute(args) {
      const topic = String(args.topic || "").trim();
      const content = String(args.content || "").trim();

      if (!topic || !content) {
        return JSON.stringify({ success: false, error: "topic and content are required" });
      }

      const { error } = await context.supabase.from("user_memories").upsert(
        {
          user_id: context.userId,
          topic,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,topic" },
      );

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      return JSON.stringify({ success: true, topic, content });
    },
  };
}
