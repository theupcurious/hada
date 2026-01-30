#!/usr/bin/env node
/**
 * Hada Calendar MCP Server
 * Exposes Google Calendar and Gmail tools via Model Context Protocol
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Get configuration from environment
const NEXT_APP_URL = process.env.NEXT_APP_URL || "http://localhost:3000";
const API_TOKEN = process.env.OPENCLAW_API_TOKEN || "";

console.error("[MCP Server] Starting Hada Calendar MCP Server");
console.error("[MCP Server] Next.js URL:", NEXT_APP_URL);
console.error("[MCP Server] API Token present:", !!API_TOKEN);

// Create MCP server
const server = new Server(
  {
    name: "hada-calendar-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const CALENDAR_TOOLS = [
  {
    name: "list_calendar_events",
    description:
      "Get the user's calendar events within a date range. Use this when the user asks about their schedule, meetings, or availability.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in ISO 8601 format (e.g., '2026-01-30T00:00:00Z')",
        },
        end_date: {
          type: "string",
          description: "End date in ISO 8601 format (e.g., '2026-02-06T23:59:59Z')",
        },
        max_results: {
          type: "number",
          description: "Maximum number of events to return (default: 10)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "create_calendar_event",
    description:
      "Create a new calendar event. Use this when the user asks to schedule a meeting, set up an appointment, or add an event to their calendar.",
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Event title/summary",
        },
        start: {
          type: "string",
          description: "Start datetime in ISO 8601 format (e.g., '2026-01-30T14:00:00Z')",
        },
        end: {
          type: "string",
          description: "End datetime in ISO 8601 format (e.g., '2026-01-30T15:00:00Z')",
        },
        description: {
          type: "string",
          description: "Event description or notes",
        },
        location: {
          type: "string",
          description: "Event location or meeting room",
        },
        attendees: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Email addresses of attendees",
        },
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "update_calendar_event",
    description:
      "Update an existing calendar event. Use this when the user wants to reschedule or modify an event.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The ID of the event to update",
        },
        summary: {
          type: "string",
          description: "New event title/summary",
        },
        start: {
          type: "string",
          description: "New start datetime in ISO 8601 format",
        },
        end: {
          type: "string",
          description: "New end datetime in ISO 8601 format",
        },
        description: {
          type: "string",
          description: "New event description",
        },
        location: {
          type: "string",
          description: "New event location",
        },
      },
      required: ["event_id"],
    },
  },
  {
    name: "delete_calendar_event",
    description:
      "Delete or cancel a calendar event. Use this when the user wants to cancel or remove an event.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The ID of the event to delete",
        },
      },
      required: ["event_id"],
    },
  },
];

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[MCP Server] Listing tools");
  return {
    tools: CALENDAR_TOOLS,
  };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[MCP Server] Executing tool: ${name}`);
  console.error(`[MCP Server] Arguments:`, JSON.stringify(args, null, 2));

  // Map tool names to API endpoints
  const toolMap = {
    list_calendar_events: `${NEXT_APP_URL}/api/tools/calendar/list-events`,
    create_calendar_event: `${NEXT_APP_URL}/api/tools/calendar/create-event`,
    update_calendar_event: `${NEXT_APP_URL}/api/tools/calendar/update-event`,
    delete_calendar_event: `${NEXT_APP_URL}/api/tools/calendar/delete-event`,
  };

  const url = toolMap[name];
  if (!url) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Get userId from session context (passed by OpenClaw)
  // OpenClaw should provide this in the session metadata
  const userId = args.userId || process.env.MCP_USER_ID;

  if (!userId) {
    console.error("[MCP Server] ERROR: No user ID provided");
    throw new Error("User ID required for calendar operations");
  }

  console.error(`[MCP Server] Calling API: ${url}`);
  console.error(`[MCP Server] User ID: ${userId}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
        "X-Session-Key": userId,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MCP Server] API Error (${response.status}):`, errorText);
      throw new Error(`API request failed: ${errorText}`);
    }

    const result = await response.json();
    console.error("[MCP Server] API Success:", JSON.stringify(result, null, 2));

    if (!result.success) {
      throw new Error(result.error?.message || "Tool execution failed");
    }

    // Format response for MCP
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error("[MCP Server] Error:", error);
    throw error;
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP Server] Hada Calendar MCP server running on stdio");
}

main().catch((error) => {
  console.error("[MCP Server] Fatal error:", error);
  process.exit(1);
});
