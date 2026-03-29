import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type { ToolContext } from "@/lib/chat/tools/types";

export const readDocumentManifest: ToolManifest = {
  name: "read_document",
  displayName: "Read Document",
  description:
    "Read the full content of a user document by its ID or title. Use list_documents first to find the right document.",
  category: "documents",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The document ID (preferred if known).",
      },
      title: {
        type: "string",
        description: "The document title (used if ID is not known).",
      },
    },
    required: [],
  },
};

export function createReadDocumentTool(context: ToolContext): AgentTool {
  return {
    name: readDocumentManifest.name,
    description: readDocumentManifest.description,
    parameters: readDocumentManifest.parameters,
    async execute(args) {
      const id = args.id ? String(args.id).trim() : null;
      const title = args.title ? String(args.title).trim() : null;

      if (!id && !title) {
        return "Error: provide either id or title.";
      }

      let query = context.supabase
        .from("documents")
        .select("id, title, folder, content, updated_at")
        .eq("user_id", context.userId);

      if (id) {
        query = query.eq("id", id);
      } else if (title) {
        query = query.ilike("title", title);
      }

      const { data, error } = await query.limit(1).single();

      if (error || !data) {
        return `Document not found: ${id ?? title}`;
      }

      const folder = (data.folder as string | null) ? `${data.folder}/` : "";
      const header = `# ${data.title as string}\n_Path: ${folder}${data.title as string} · Updated: ${new Date(data.updated_at as string).toLocaleDateString()}_\n\n`;
      return header + String(data.content ?? "");
    },
  };
}
