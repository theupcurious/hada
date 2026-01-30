# MCP Server Integration for OpenClaw

## Overview

To integrate calendar tools with OpenClaw properly, we need to create an MCP (Model Context Protocol) server that exposes our tools.

## Architecture

```
OpenClaw Gateway
    ↓ (MCP protocol)
MCP Server (Node.js)
    ↓ (HTTP calls)
Next.js Tool APIs (/api/tools/*)
    ↓
Google Calendar/Gmail APIs
```

## Implementation Steps

### 1. Create MCP Server

Create a standalone Node.js MCP server that OpenClaw can connect to:

**File: `mcp-server/index.js`**

```javascript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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

// Register calendar tools
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "list_calendar_events",
        description: "Get calendar events within a date range",
        inputSchema: {
          type: "object",
          properties: {
            start_date: {
              type: "string",
              description: "Start date in ISO 8601 format",
            },
            end_date: {
              type: "string",
              description: "End date in ISO 8601 format",
            },
          },
          required: ["start_date", "end_date"],
        },
      },
      {
        name: "create_calendar_event",
        description: "Create a new calendar event",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Event title" },
            start: { type: "string", description: "Start datetime ISO 8601" },
            end: { type: "string", description: "End datetime ISO 8601" },
            description: { type: "string" },
            location: { type: "string" },
          },
          required: ["summary", "start", "end"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  // Call Next.js API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const toolMap = {
    list_calendar_events: `${baseUrl}/api/tools/calendar/list-events`,
    create_calendar_event: `${baseUrl}/api/tools/calendar/create-event`,
  };

  const url = toolMap[name];
  if (!url) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Extract userId from environment or session
  const userId = process.env.MCP_USER_ID || args.userId;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENCLAW_API_TOKEN}`,
      "X-Session-Key": userId,
    },
    body: JSON.stringify(args),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "Tool execution failed");
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hada Calendar MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

**File: `mcp-server/package.json`**

```json
{
  "name": "hada-calendar-mcp",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  }
}
```

### 2. Update OpenClaw Config

**File: `openclaw/config/openclaw.json`**

```json
{
  "mcpServers": {
    "hada-calendar": {
      "command": "node",
      "args": ["/app/mcp-server/index.js"],
      "env": {
        "NEXT_PUBLIC_APP_URL": "http://nextjs:3000",
        "OPENCLAW_API_TOKEN": "${OPENCLAW_API_TOKEN}",
        "MCP_USER_ID": "${SESSION_USER_ID}"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "minimax/MiniMax-M2.1"
      }
    }
  },
  "models": {
    "providers": {
      "minimax": {
        "baseUrl": "https://api.minimax.io/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "MiniMax-M2.1",
            "name": "MiniMax M2.1",
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local"
  }
}
```

### 3. Update Dockerfile

Add MCP server to the OpenClaw container:

```dockerfile
# Copy MCP server
COPY mcp-server /app/mcp-server
RUN cd /app/mcp-server && npm install
```

## Trade-offs

### MCP Server Approach (Through OpenClaw)
✅ Proper integration with OpenClaw's architecture
✅ AI can decide when to use tools naturally
✅ Consistent with OpenClaw's design
❌ More complex setup (MCP server + config)
❌ Requires rebuilding Docker container
❌ Harder to debug

### Current Function Calling Approach (Bypass OpenClaw)
✅ Simpler implementation
✅ Direct control over tool execution
✅ Easier to debug and test
✅ No Docker rebuild needed
❌ Bypasses OpenClaw for calendar ops
❌ Two separate AI paths (OpenClaw + LLM)

## Recommendation

**Keep the current function calling approach** unless you specifically need:
- OpenClaw's browser automation combined with calendar tools
- Single unified AI conversation flow
- OpenClaw's context management for tool calls

The function calling approach is production-ready and works well. The MCP approach is architecturally cleaner but adds complexity.

## Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OpenClaw MCP Integration](https://github.com/openclaw/openclaw/blob/main/docs/mcp.md)
