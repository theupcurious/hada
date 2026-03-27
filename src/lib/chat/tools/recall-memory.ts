import type { AgentTool } from "@/lib/chat/agent-loop";
import { generateEmbedding } from "@/lib/chat/embeddings";
import type { ToolContext } from "@/lib/chat/tools/types";

import type { ToolManifest } from "@/lib/chat/tools/tool-registry";

export const recallMemoryManifest: ToolManifest = {
  name: "recall_memory",
  displayName: "Recall Memory",
  description:
    "Search long-term memory for this user. Provide a keyword or phrase to search across topics and content, or omit to return all memories.",
  category: "memory",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Search query that matches against both topic keys and content. Omit to return all.",
      },
    },
    required: [],
  },
};

export function createRecallMemoryTool(context: ToolContext): AgentTool {
  return {
    name: recallMemoryManifest.name,
    description: recallMemoryManifest.description,
    parameters: recallMemoryManifest.parameters,
    async execute(args) {
      const query = typeof args.topic === "string" ? args.topic.trim() : "";

      if (!query) {
        const { data, error } = await context.supabase
          .from("user_memories")
          .select("topic, content, updated_at")
          .eq("user_id", context.userId)
          .order("updated_at", { ascending: false })
          .limit(50);

        if (error) {
          return JSON.stringify({ success: false, error: error.message });
        }

        return JSON.stringify({ success: true, memories: data || [] });
      }

      const embedding = await generateEmbedding(query);
      if (embedding) {
        const { data: semanticResults, error: semanticError } = await context.supabase.rpc(
          "match_user_memories",
          {
            query_embedding: JSON.stringify(embedding),
            match_user_id: context.userId,
            match_threshold: 0.3,
            match_count: 20,
          },
        );

        if (!semanticError && semanticResults && semanticResults.length > 0) {
          return JSON.stringify({ success: true, memories: semanticResults });
        }
      }

      const { data, error } = await context.supabase
        .from("user_memories")
        .select("topic, content, updated_at")
        .eq("user_id", context.userId)
        .or(`topic.ilike.%${query}%,content.ilike.%${query}%`)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      return JSON.stringify({ success: true, memories: data || [] });
    },
  };
}
