import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type { ToolContext } from "@/lib/chat/tools/types";

export const mcpCallManifest: ToolManifest = {
  name: "mcp_call",
  displayName: "MCP Call",
  description:
    "Call a tool on a Model Context Protocol (MCP) server. Use this to access external capabilities not built into Hada.",
  category: "custom",
  riskLevel: "high",
  parameters: {
    type: "object",
    properties: {
      serverUrl: {
        type: "string",
        description: "The URL of the MCP server (e.g., http://localhost:3001).",
      },
      toolName: {
        type: "string",
        description: "The name of the tool to call on the MCP server.",
      },
      arguments: {
        type: "object",
        description: "The arguments for the tool call.",
      },
    },
    required: ["serverUrl", "toolName", "arguments"],
  },
};

export function createMcpCallTool(context: ToolContext): AgentTool {
  void context;
  return {
    name: mcpCallManifest.name,
    description: mcpCallManifest.description,
    parameters: mcpCallManifest.parameters,
    async execute(args) {
      const serverUrl = String(args.serverUrl || "").trim();
      const toolName = String(args.toolName || "").trim();
      const toolArgs = (args.arguments && typeof args.arguments === "object") ? args.arguments : {};

      if (!serverUrl || !toolName) {
        return "Error: serverUrl and toolName are required.";
      }

      try {
        const response = await fetch(`${serverUrl}/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "tools/call",
            params: {
              name: toolName,
              arguments: toolArgs,
            },
          }),
        });

        if (!response.ok) {
          return `MCP Server Error: ${response.status} ${response.statusText}`;
        }

        const data = await response.json();
        return JSON.stringify(data.result || data);
      } catch (error) {
        return `Error calling MCP server: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  };
}
