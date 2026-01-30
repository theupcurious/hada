import { NextRequest, NextResponse } from "next/server";
import {
  authenticateToolRequest,
  verifyGoogleIntegration,
  verifyPermission,
} from "@/lib/tool-auth";
import { ensureValidGoogleToken } from "@/lib/google/tokens";
import { updateCalendarEvent } from "@/lib/google/calendar";

/**
 * Update calendar event
 * Tool endpoint for OpenClaw to modify existing calendar events
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

    // Validate required parameters
    if (!params.eventId && !params.event_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Missing required parameter: eventId",
          },
        },
        { status: 400 }
      );
    }

    const eventId = params.eventId || params.event_id;

    // 2. Verify Google integration exists
    const integrationCheck = await verifyGoogleIntegration(userId);
    if (!integrationCheck.success) {
      return NextResponse.json(
        { success: false, error: integrationCheck.error },
        { status: 403 }
      );
    }

    // 3. Check permissions (write calendar) - may require confirmation
    const permissionCheck = await verifyPermission(
      userId,
      "google_calendar_write",
      {
        action: "update_calendar_event",
        eventId,
        updates: {
          summary: params.summary,
          description: params.description,
          start: params.start,
          end: params.end,
          location: params.location,
          attendees: params.attendees,
        },
      }
    );

    if (!permissionCheck.success) {
      if (permissionCheck.requiresConfirmation) {
        return NextResponse.json({
          success: false,
          error: permissionCheck.error,
          requiresConfirmation: true,
          confirmationData: permissionCheck.confirmationData,
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
    const event = await updateCalendarEvent(accessToken, eventId, {
      summary: params.summary,
      description: params.description,
      start: params.start,
      end: params.end,
      location: params.location,
      attendees: params.attendees,
      timeZone: params.timeZone,
    });

    // 6. Return structured response with card
    return NextResponse.json({
      success: true,
      data: event,
      card: {
        type: "calendar_event",
        data: {
          id: event.id,
          summary: event.summary,
          description: event.description,
          start: event.start.dateTime,
          end: event.end.dateTime,
          location: event.location,
          attendees: event.attendees?.map((a) => a.email),
          htmlLink: event.htmlLink,
          hangoutLink: event.hangoutLink,
        },
        actions: ["reschedule", "cancel", "join"],
      },
    });
  } catch (error: any) {
    console.error("Error updating calendar event:", error);

    // Handle not found errors
    if (error.message.includes("404")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Calendar event not found. It may have been deleted.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: error.message || "Failed to update calendar event",
        },
      },
      { status: 500 }
    );
  }
}
