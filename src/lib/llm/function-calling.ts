/**
 * LLM Function Calling for Calendar & Gmail Tools
 * Bypasses OpenClaw and calls our tools directly via LLM function calling
 */

import { hasGoogleIntegration } from "@/lib/google/tokens";

export interface FunctionCall {
  name: string;
  arguments: any;
}

export interface FunctionCallResponse {
  shouldUseFunctions: boolean;
  functions?: FunctionCall[];
  response?: string;
}

const CALENDAR_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description:
        "Get the user's calendar events within a date range. Use this when the user asks about their schedule, meetings, or availability.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description:
        "Create a new calendar event. Use this when the user asks to schedule a meeting, set up an appointment, or add an event to their calendar.",
      parameters: {
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
            items: { type: "string" },
            description: "Email addresses of attendees",
          },
        },
        required: ["summary", "start", "end"],
      },
    },
  },
];

/**
 * Check if user message might need calendar/email tools
 */
export function mightNeedTools(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const calendarKeywords = [
    "calendar",
    "schedule",
    "meeting",
    "appointment",
    "event",
    "busy",
    "free time",
    "available",
    "tomorrow",
    "today",
    "this week",
    "next week",
  ];

  const emailKeywords = ["email", "inbox", "mail", "message", "send"];

  return (
    calendarKeywords.some((kw) => lowerMessage.includes(kw)) ||
    emailKeywords.some((kw) => lowerMessage.includes(kw))
  );
}

/**
 * Call LLM with function calling to detect tool usage
 */
export async function detectFunctionCalls(
  message: string,
  userId: string
): Promise<FunctionCallResponse> {
  console.log("[Function Calling] Checking message:", message);

  // Quick check - if message doesn't mention calendar/email, skip function calling
  if (!mightNeedTools(message)) {
    console.log("[Function Calling] No calendar/email keywords detected");
    return { shouldUseFunctions: false };
  }

  console.log("[Function Calling] Calendar/email keywords detected");

  // Check if user has Google integration
  const hasGoogle = await hasGoogleIntegration(userId);
  if (!hasGoogle) {
    console.log("[Function Calling] User has no Google integration");
    return {
      shouldUseFunctions: false,
      response:
        "To check your calendar or emails, please connect your Google account in Settings first.",
    };
  }

  console.log("[Function Calling] User has Google integration");

  // Call LLM with function calling
  const apiKey = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    console.error("[Function Calling] No API key configured");
    return { shouldUseFunctions: false };
  }

  console.log("[Function Calling] Calling LLM with function calling...");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.MINIMAX_MODEL || "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant with access to the user's Google Calendar. When the user asks about their schedule or wants to create events, use the available functions. Current date: " +
              new Date().toISOString(),
          },
          {
            role: "user",
            content: message,
          },
        ],
        tools: CALENDAR_TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Function Calling] LLM API failed:", response.status, errorText);
      return { shouldUseFunctions: false };
    }

    const data = await response.json();
    console.log("[Function Calling] LLM response:", JSON.stringify(data, null, 2));

    const aiMessage = data.choices[0].message;

    // Check if LLM wants to call functions
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const functions = aiMessage.tool_calls.map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      console.log("[Function Calling] Tool calls detected:", functions);

      return {
        shouldUseFunctions: true,
        functions,
      };
    }

    console.log("[Function Calling] No tool calls in response");
    return { shouldUseFunctions: false };
  } catch (error) {
    console.error("[Function Calling] Error:", error);
    return { shouldUseFunctions: false };
  }
}

/**
 * Execute a function call by calling our tool API
 */
export async function executeFunction(
  functionCall: FunctionCall,
  userId: string
): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const toolMap: Record<string, string> = {
    list_calendar_events: `${baseUrl}/api/tools/calendar/list-events`,
    create_calendar_event: `${baseUrl}/api/tools/calendar/create-event`,
    update_calendar_event: `${baseUrl}/api/tools/calendar/update-event`,
    delete_calendar_event: `${baseUrl}/api/tools/calendar/delete-event`,
  };

  const url = toolMap[functionCall.name];
  if (!url) {
    throw new Error(`Unknown function: ${functionCall.name}`);
  }

  const token = process.env.OPENCLAW_API_TOKEN;
  console.log("[Execute Function] Token present:", !!token, "Length:", token?.length || 0);
  console.log("[Execute Function] Calling:", url);
  console.log("[Execute Function] User ID:", userId);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
      "X-Session-Key": userId,
    },
    body: JSON.stringify(functionCall.arguments),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Function execution failed");
  }

  return response.json();
}
