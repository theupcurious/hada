import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";

export function createRecallMemoryTool(context: ToolContext): AgentTool {
  return {
    name: "recall_memory",
    description:
      "Recall long-term memory topics for this user. Optional topic filter returns a specific memory.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Optional topic key to filter by.",
        },
      },
      required: [],
    },
    async execute(args) {
      const topic = typeof args.topic === "string" ? args.topic.trim() : "";

      let query = context.supabase
        .from("user_memories")
        .select("topic, content, updated_at")
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (topic) {
        query = query.eq("topic", topic);
      }

      const { data, error } = await query;

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      return JSON.stringify({ success: true, memories: data || [] });
    },
  };
}
