import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import { ensureValidGoogleToken } from "@/lib/google/tokens";
import { readFileContent, searchFiles } from "@/lib/google/drive";

export const driveSearchManifest: ToolManifest = {
  name: "drive_search",
  displayName: "Drive Search",
  description:
    "Search the user's Google Drive by keyword. Returns files with ids for drive_read. Use to locate a document the user refers to.",
  category: "documents",
  riskLevel: "low",
  requiresIntegration: "google",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword or filename to search for." },
      max_results: { type: "number", description: "Maximum files to return (default 10, max 25)." },
    },
    required: ["query"],
  },
};

export const driveReadManifest: ToolManifest = {
  name: "drive_read",
  displayName: "Drive Read",
  description:
    "Read the text content of a Google Drive file by id (from drive_search). Google Docs/Sheets/Slides are exported as text. Binary files (PDF, images) can't be read here.",
  category: "documents",
  riskLevel: "low",
  requiresIntegration: "google",
  parameters: {
    type: "object",
    properties: {
      file_id: { type: "string", description: "The Drive file id." },
    },
    required: ["file_id"],
  },
};

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function notConnected(): string {
  return stringify({ success: false, error: "Google account not connected or token expired." });
}

export function createDriveTools(context: ToolContext): AgentTool[] {
  const token = () => ensureValidGoogleToken(context.userId, context.supabase);

  return [
    {
      name: driveSearchManifest.name,
      description: driveSearchManifest.description,
      parameters: driveSearchManifest.parameters,
      async execute(args) {
        const accessToken = await token();
        if (!accessToken) return notConnected();
        const query = String(args.query || "").trim();
        if (!query) return stringify({ success: false, error: "query is required" });
        const maxResults = Number(args.max_results || args.maxResults || 10) || 10;
        try {
          const files = await searchFiles(accessToken, query, maxResults);
          return stringify({ success: true, count: files.length, files });
        } catch (error) {
          return stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to search Drive",
          });
        }
      },
    },
    {
      name: driveReadManifest.name,
      description: driveReadManifest.description,
      parameters: driveReadManifest.parameters,
      async execute(args) {
        const accessToken = await token();
        if (!accessToken) return notConnected();
        const fileId = String(args.file_id || args.fileId || args.id || "").trim();
        if (!fileId) return stringify({ success: false, error: "file_id is required" });
        try {
          const file = await readFileContent(accessToken, fileId);
          return stringify({ success: true, ...file });
        } catch (error) {
          return stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to read Drive file",
          });
        }
      },
    },
  ];
}
