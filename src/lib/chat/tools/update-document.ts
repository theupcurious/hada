import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type { ToolContext } from "@/lib/chat/tools/types";

export const updateDocumentManifest: ToolManifest = {
  name: "update_document",
  displayName: "Update Document",
  description:
    "Update an existing document in the user's workspace. Returns the updated document status.",
  category: "documents",
  riskLevel: "medium",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The document ID (required).",
      },
      title: {
        type: "string",
        description: "Optional new title.",
      },
      content: {
        type: "string",
        description: "The full new markdown content of the document.",
      },
      folder: {
        type: "string",
        description: "Optional new folder name.",
      },
    },
    required: ["id", "content"],
  },
};

export function createUpdateDocumentTool(context: ToolContext): AgentTool {
  return {
    name: updateDocumentManifest.name,
    description: updateDocumentManifest.description,
    parameters: updateDocumentManifest.parameters,
    async execute(args) {
      const id = String(args.id || "").trim();
      if (!id) return "Error: Document ID is required.";

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (typeof args.content === "string") {
        updates.content = args.content;
      }

      if (typeof args.title === "string") {
        updates.title = args.title.trim() || "Untitled";
      }

      if (typeof args.folder === "string") {
        updates.folder = args.folder.trim() || null;
      }

      const { data, error } = await context.supabase
        .from("documents")
        .update(updates)
        .eq("id", id)
        .eq("user_id", context.userId)
        .select()
        .single();

      if (error || !data) {
        return `Error updating document: ${error?.message || "Not found"}`;
      }

      return JSON.stringify({
        id: data.id,
        title: data.title,
        status: "updated",
        url: `/docs?id=${data.id}`,
      });
    },
  };
}
