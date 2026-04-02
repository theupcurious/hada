import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type { ToolContext } from "@/lib/chat/tools/types";

export const createDocumentManifest: ToolManifest = {
  name: "create_document",
  displayName: "Create Document",
  description:
    "Create a new document in the user's workspace. Returns the created document ID.",
  category: "documents",
  riskLevel: "medium",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The document title.",
      },
      content: {
        type: "string",
        description: "The markdown content of the document.",
      },
      folder: {
        type: "string",
        description: "Optional folder name (e.g., 'Work', 'Personal').",
      },
    },
    required: ["title", "content"],
  },
};

export function createCreateDocumentTool(context: ToolContext): AgentTool {
  return {
    name: createDocumentManifest.name,
    description: createDocumentManifest.description,
    parameters: createDocumentManifest.parameters,
    async execute(args) {
      const title = String(args.title ?? "Untitled").trim() || "Untitled";
      const content = String(args.content ?? "");
      const folder = args.folder ? String(args.folder).trim() || null : null;

      const { data, error } = await context.supabase
        .from("documents")
        .insert({
          user_id: context.userId,
          title,
          content,
          folder,
        })
        .select()
        .single();

      if (error || !data) {
        return `Error creating document: ${error?.message || "Unknown error"}`;
      }

      return JSON.stringify({
        id: data.id,
        title: data.title,
        status: "created",
        url: `/docs?id=${data.id}`,
      });
    },
  };
}
