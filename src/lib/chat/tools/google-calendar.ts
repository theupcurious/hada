import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from "@/lib/google/calendar";
import { ensureValidGoogleToken } from "@/lib/google/tokens";

function stringifyResult(value: unknown): string {
  return JSON.stringify(value);
}

async function getGoogleAccessToken(context: ToolContext): Promise<string | null> {
  return ensureValidGoogleToken(context.userId, context.supabase);
}

export function createGoogleCalendarTools(context: ToolContext): AgentTool[] {
  return [
    {
      name: "list_calendar_events",
      description: "List events from the user's Google Calendar in a date/time range.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "ISO datetime start." },
          end_date: { type: "string", description: "ISO datetime end." },
          max_results: { type: "number", description: "Maximum results (default 10)." },
          query: { type: "string", description: "Optional text query." },
        },
        required: ["start_date", "end_date"],
      },
      async execute(args) {
        const accessToken = await getGoogleAccessToken(context);
        if (!accessToken) {
          return stringifyResult({
            success: false,
            error: "Google account not connected or token expired.",
          });
        }

        const timeMin = String(args.start_date || args.timeMin || "").trim();
        const timeMax = String(args.end_date || args.timeMax || "").trim();
        const maxResults = Number(args.max_results || args.maxResults || 10) || 10;
        const q = typeof args.query === "string" ? args.query : undefined;

        if (!timeMin || !timeMax) {
          return stringifyResult({
            success: false,
            error: "start_date and end_date are required",
          });
        }

        try {
          const events = await listCalendarEvents(accessToken, {
            timeMin,
            timeMax,
            maxResults,
            q,
          });

          return stringifyResult({
            success: true,
            events: events.map((event) => ({
              id: event.id,
              summary: event.summary,
              description: event.description,
              start: event.start?.dateTime,
              end: event.end?.dateTime,
              location: event.location,
              attendees: event.attendees?.map((a) => a.email),
              htmlLink: event.htmlLink,
            })),
          });
        } catch (error) {
          return stringifyResult({
            success: false,
            error: error instanceof Error ? error.message : "Failed to list events",
          });
        }
      },
    },
    {
      name: "create_calendar_event",
      description: "Create an event in the user's Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title." },
          start: { type: "string", description: "ISO datetime start." },
          end: { type: "string", description: "ISO datetime end." },
          description: { type: "string" },
          location: { type: "string" },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "List of attendee emails.",
          },
          timeZone: { type: "string" },
        },
        required: ["summary", "start", "end"],
      },
      async execute(args) {
        const accessToken = await getGoogleAccessToken(context);
        if (!accessToken) {
          return stringifyResult({ success: false, error: "Google account not connected." });
        }

        const summary = String(args.summary || "").trim();
        const start = String(args.start || "").trim();
        const end = String(args.end || "").trim();

        if (!summary || !start || !end) {
          return stringifyResult({ success: false, error: "summary, start, and end are required" });
        }

        try {
          const event = await createCalendarEvent(accessToken, {
            summary,
            start,
            end,
            description: typeof args.description === "string" ? args.description : undefined,
            location: typeof args.location === "string" ? args.location : undefined,
            attendees: Array.isArray(args.attendees)
              ? args.attendees.map((a) => String(a)).filter(Boolean)
              : undefined,
            timeZone: typeof args.timeZone === "string" ? args.timeZone : undefined,
          });

          return stringifyResult({
            success: true,
            event: {
              id: event.id,
              summary: event.summary,
              description: event.description,
              start: event.start?.dateTime,
              end: event.end?.dateTime,
              location: event.location,
              attendees: event.attendees?.map((a) => a.email),
              htmlLink: event.htmlLink,
              hangoutLink: event.hangoutLink,
            },
          });
        } catch (error) {
          return stringifyResult({
            success: false,
            error: error instanceof Error ? error.message : "Failed to create event",
          });
        }
      },
    },
    {
      name: "update_calendar_event",
      description: "Update an existing Google Calendar event by ID.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Calendar event ID." },
          summary: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          attendees: {
            type: "array",
            items: { type: "string" },
          },
          timeZone: { type: "string" },
        },
        required: ["event_id"],
      },
      async execute(args) {
        const accessToken = await getGoogleAccessToken(context);
        if (!accessToken) {
          return stringifyResult({ success: false, error: "Google account not connected." });
        }

        const eventId = String(args.event_id || args.eventId || "").trim();
        if (!eventId) {
          return stringifyResult({ success: false, error: "event_id is required" });
        }

        try {
          const event = await updateCalendarEvent(accessToken, eventId, {
            summary: typeof args.summary === "string" ? args.summary : undefined,
            start: typeof args.start === "string" ? args.start : undefined,
            end: typeof args.end === "string" ? args.end : undefined,
            description: typeof args.description === "string" ? args.description : undefined,
            location: typeof args.location === "string" ? args.location : undefined,
            attendees: Array.isArray(args.attendees)
              ? args.attendees.map((a) => String(a)).filter(Boolean)
              : undefined,
            timeZone: typeof args.timeZone === "string" ? args.timeZone : undefined,
          });

          return stringifyResult({
            success: true,
            event: {
              id: event.id,
              summary: event.summary,
              description: event.description,
              start: event.start?.dateTime,
              end: event.end?.dateTime,
              location: event.location,
              attendees: event.attendees?.map((a) => a.email),
              htmlLink: event.htmlLink,
              hangoutLink: event.hangoutLink,
            },
          });
        } catch (error) {
          return stringifyResult({
            success: false,
            error: error instanceof Error ? error.message : "Failed to update event",
          });
        }
      },
    },
    {
      name: "delete_calendar_event",
      description: "Delete/cancel a Google Calendar event by ID.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Calendar event ID." },
        },
        required: ["event_id"],
      },
      async execute(args) {
        const accessToken = await getGoogleAccessToken(context);
        if (!accessToken) {
          return stringifyResult({ success: false, error: "Google account not connected." });
        }

        const eventId = String(args.event_id || args.eventId || "").trim();
        if (!eventId) {
          return stringifyResult({ success: false, error: "event_id is required" });
        }

        try {
          await deleteCalendarEvent(accessToken, eventId);
          return stringifyResult({ success: true, deleted: true, event_id: eventId });
        } catch (error) {
          return stringifyResult({
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete event",
          });
        }
      },
    },
  ];
}
