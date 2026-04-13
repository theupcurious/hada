import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type { ToolContext } from "@/lib/chat/tools/types";

export const deleteDocumentManifest: ToolManifest = {
  name: "delete_document",
  displayName: "Delete Document",
  description:
    "Delete a document from the user's workspace by ID. Use with care — this is irreversible. Primarily needed for wiki maintenance: merging duplicate pages or removing stale content during a lint pass.",
  category: "documents",
  riskLevel: "high",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The document ID to delete.",
      },
    },
    required: ["id"],
  },
};

export function createDeleteDocumentTool(context: ToolContext): AgentTool {
  return {
    name: deleteDocumentManifest.name,
    description: deleteDocumentManifest.description,
    parameters: deleteDocumentManifest.parameters,
    async execute(args) {
      const id = String(args.id ?? "").trim();
      if (!id) return JSON.stringify({ error: "id is required" });

      const { error } = await context.supabase
        .from("documents")
        .delete()
        .eq("id", id)
        .eq("user_id", context.userId);

      if (error) return JSON.stringify({ error: error.message });

      return JSON.stringify({ id, status: "deleted" });
    },
  };
}
