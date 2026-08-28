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
  const projectId = context.projectId ?? null;
  // Global memories (project_id NULL) are visible everywhere; space memories only
  // in their own space. In General (no active space) only globals are visible.
  const scopeFilter = projectId ? `project_id.is.null,project_id.eq.${projectId}` : null;

  return {
    name: recallMemoryManifest.name,
    description: recallMemoryManifest.description,
    parameters: recallMemoryManifest.parameters,
    async execute(args) {
      const query = typeof args.topic === "string" ? args.topic.trim() : "";

      if (!query) {
        let listQuery = context.supabase
          .from("user_memories")
          .select("topic, content, updated_at")
          .eq("user_id", context.userId);
        listQuery = scopeFilter
          ? listQuery.or(scopeFilter)
          : listQuery.is("project_id", null);
        const { data, error } = await listQuery
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
            match_project_id: projectId,
            match_threshold: 0.3,
            match_count: 20,
          },
        );

        if (!semanticError && semanticResults && semanticResults.length > 0) {
          return JSON.stringify({ success: true, memories: semanticResults });
        }
      }

      // Text match via .or(); scope applied in JS afterward. Chaining a second
      // .or() for scope would rely on PostgREST AND-ing the two groups — if it
      // didn't, other spaces' memories could leak through this path. The result
      // is capped at 50, so post-filtering is free and unambiguous.
      const { data, error } = await context.supabase
        .from("user_memories")
        .select("topic, content, updated_at, project_id")
        .eq("user_id", context.userId)
        .or(`topic.ilike.%${query}%,content.ilike.%${query}%`)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      const scoped = (data || []).filter((row) => {
        const rowProjectId = (row as { project_id?: string | null }).project_id ?? null;
        return rowProjectId === null || rowProjectId === projectId;
      });

      return JSON.stringify({
        success: true,
        memories: scoped.map(({ topic, content, updated_at }) => ({ topic, content, updated_at })),
      });
    },
  };
}
