import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type { ToolContext } from "@/lib/chat/tools/types";

export const listDocumentsManifest: ToolManifest = {
  name: "list_documents",
  displayName: "List Documents",
  description:
    "List the user's saved documents (title, folder, and a short preview). Call this to discover what context documents exist before deciding to read one. Use the optional folder parameter to list only documents in a specific folder (e.g., 'wiki').",
  category: "documents",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      folder: {
        type: "string",
        description: "Optional folder to filter by (e.g., 'wiki'). Omit to list all documents.",
      },
    },
    required: [],
  },
};

export function createListDocumentsTool(context: ToolContext): AgentTool {
  return {
    name: listDocumentsManifest.name,
    description: listDocumentsManifest.description,
    parameters: listDocumentsManifest.parameters,
    async execute(args) {
      const folder = args?.folder ? String(args.folder).trim() : null;

      let dbQuery = context.supabase
        .from("documents")
        .select("id, title, folder, content")
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false });

      if (folder) {
        dbQuery = dbQuery.eq("folder", folder);
      }

      const { data, error } = await dbQuery;

      if (error) return JSON.stringify({ error: error.message });

      const docs = (data ?? []).map((doc) => ({
        id: doc.id as string,
        title: doc.title as string,
        folder: (doc.folder as string | null) ?? null,
        preview: String(doc.content ?? "").slice(0, 100).replace(/\s+/g, " ").trim(),
      }));

      if (docs.length === 0) return "No documents found.";
      return JSON.stringify(docs);
    },
  };
}
