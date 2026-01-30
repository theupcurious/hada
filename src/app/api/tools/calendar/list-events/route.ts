import { NextRequest, NextResponse } from "next/server";
import {
  authenticateToolRequest,
  verifyGoogleIntegration,
  verifyPermission,
} from "@/lib/tool-auth";
import { ensureValidGoogleToken } from "@/lib/google/tokens";
import { listCalendarEvents } from "@/lib/google/calendar";

/**
 * List calendar events
 * Tool endpoint for OpenClaw to fetch user's calendar events
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate request
    const authResult = await authenticateToolRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const { userId, params } = authResult.data;

    // 2. Verify Google integration exists
    const integrationCheck = await verifyGoogleIntegration(userId);
    if (!integrationCheck.success) {
      return NextResponse.json(
        { success: false, error: integrationCheck.error },
        { status: 403 }
      );
    }

    // 3. Check permissions (read calendar)
    const permissionCheck = await verifyPermission(
      userId,
      "google_calendar_read"
    );
    if (!permissionCheck.success) {
      if (permissionCheck.requiresConfirmation) {
        return NextResponse.json({
          success: false,
          error: permissionCheck.error,
          requiresConfirmation: true,
          confirmationData: {
            action: "list_calendar_events",
            params,
          },
        });
      }
      return NextResponse.json(
        { success: false, error: permissionCheck.error },
        { status: 403 }
      );
    }

    // 4. Get valid access token (auto-refresh if needed)
    const accessToken = await ensureValidGoogleToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message:
              "Your Google connection has expired. Please reconnect your account.",
            action: "reconnect",
          },
        },
        { status: 401 }
      );
    }

    // 5. Call Google Calendar API
    const events = await listCalendarEvents(accessToken, {
      timeMin: params.timeMin || params.start_date,
      timeMax: params.timeMax || params.end_date,
      maxResults: params.maxResults || params.max_results || 10,
      q: params.q || params.query,
    });

    // 6. Return structured response
    return NextResponse.json({
      success: true,
      data: events,
      card: {
        type: "calendar_events_list",
        data: {
          events: events.map((event) => ({
            id: event.id,
            summary: event.summary,
            start: event.start.dateTime,
            end: event.end.dateTime,
            location: event.location,
            attendees: event.attendees?.map((a) => a.email),
          })),
        },
      },
    });
  } catch (error: any) {
    console.error("Error listing calendar events:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: error.message || "Failed to list calendar events",
        },
      },
      { status: 500 }
    );
  }
}
