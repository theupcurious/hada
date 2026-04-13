import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type { ToolContext } from "@/lib/chat/tools/types";

export const searchDocumentsManifest: ToolManifest = {
  name: "search_documents",
  displayName: "Search Documents",
  description:
    "Search documents by keyword across titles and content. Optionally filter by folder (e.g., 'wiki'). Returns matching documents with a short content snippet.",
  category: "documents",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search keyword or phrase to look for in document titles and content.",
      },
      folder: {
        type: "string",
        description: "Optional folder to search within (e.g., 'wiki').",
      },
    },
    required: ["query"],
  },
};

export function createSearchDocumentsTool(context: ToolContext): AgentTool {
  return {
    name: searchDocumentsManifest.name,
    description: searchDocumentsManifest.description,
    parameters: searchDocumentsManifest.parameters,
    async execute(args) {
      const query = String(args.query ?? "").trim();
      if (!query) return JSON.stringify({ error: "query is required" });

      const folder = args.folder ? String(args.folder).trim() : null;
      const pattern = `%${query}%`;

      let dbQuery = context.supabase
        .from("documents")
        .select("id, title, folder, content")
        .eq("user_id", context.userId)
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (folder) {
        dbQuery = dbQuery.eq("folder", folder);
      }

      const { data, error } = await dbQuery;

      if (error) return JSON.stringify({ error: error.message });

      const docs = (data ?? []).map((doc) => {
        const content = String(doc.content ?? "");
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const matchIndex = lowerContent.indexOf(lowerQuery);
        let snippet: string;
        if (matchIndex >= 0) {
          const start = Math.max(0, matchIndex - 60);
          const end = Math.min(content.length, matchIndex + query.length + 120);
          snippet = (start > 0 ? "…" : "") + content.slice(start, end).replace(/\s+/g, " ").trim() + (end < content.length ? "…" : "");
        } else {
          snippet = content.slice(0, 150).replace(/\s+/g, " ").trim();
        }
        return {
          id: doc.id as string,
          title: doc.title as string,
          folder: (doc.folder as string | null) ?? null,
          snippet,
        };
      });

      if (docs.length === 0) return `No documents found matching "${query}"${folder ? ` in folder "${folder}"` : ""}.`;
      return JSON.stringify(docs);
    },
  };
}
