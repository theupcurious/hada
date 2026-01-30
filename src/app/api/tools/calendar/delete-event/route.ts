import { NextRequest, NextResponse } from "next/server";
import {
  authenticateToolRequest,
  verifyGoogleIntegration,
  verifyPermission,
} from "@/lib/tool-auth";
import { ensureValidGoogleToken } from "@/lib/google/tokens";
import { deleteCalendarEvent } from "@/lib/google/calendar";

/**
 * Delete calendar event
 * Tool endpoint for OpenClaw to cancel/delete calendar events
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
        action: "delete_calendar_event",
        eventId,
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
    await deleteCalendarEvent(accessToken, eventId);

    // 6. Return success response
    return NextResponse.json({
      success: true,
      message: "Calendar event deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting calendar event:", error);

    // Handle not found errors
    if (error.message.includes("404") || error.message.includes("410")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Calendar event not found. It may already be deleted.",
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
          message: error.message || "Failed to delete calendar event",
        },
      },
      { status: 500 }
    );
  }
}
