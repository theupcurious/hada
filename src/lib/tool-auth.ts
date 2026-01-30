import { NextRequest } from "next/server";
import { hasGoogleIntegration } from "@/lib/google/tokens";
import { checkPermission, type PermissionKey } from "@/lib/permissions";

export interface ToolRequest {
  userId: string;
  params: any;
}

export interface ToolError {
  code:
    | "UNAUTHORIZED"
    | "NOT_AUTHENTICATED"
    | "NOT_CONNECTED"
    | "PERMISSION_DENIED"
    | "CONFIRMATION_REQUIRED"
    | "INVALID_REQUEST";
  message: string;
  action?: "reconnect" | "configure_permissions";
}

/**
 * Authenticate a tool request from OpenClaw
 * Validates the request is from OpenClaw and extracts user context
 */
export async function authenticateToolRequest(
  request: NextRequest
): Promise<{ success: true; data: ToolRequest } | { success: false; error: ToolError }> {
  // Verify OpenClaw token
  const authHeader = request.headers.get("Authorization");
  const expectedToken = process.env.OPENCLAW_API_TOKEN;

  console.log("[Tool Auth] Auth header:", authHeader);
  console.log("[Tool Auth] Expected token present:", !!expectedToken, "Length:", expectedToken?.length || 0);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[Tool Auth] FAILED: Missing or invalid Authorization header");
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
      },
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  if (expectedToken && token !== expectedToken) {
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid OpenClaw token",
      },
    };
  }

  // Extract user ID from session key
  const sessionKey = request.headers.get("X-Session-Key");

  if (!sessionKey) {
    return {
      success: false,
      error: {
        code: "NOT_AUTHENTICATED",
        message: "Missing X-Session-Key header",
      },
    };
  }

  const userId = sessionKey; // sessionKey is already userId in our system

  // Parse request body
  let params: any;
  try {
    const text = await request.text();
    params = text ? JSON.parse(text) : {};
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid JSON in request body",
      },
    };
  }

  return {
    success: true,
    data: { userId, params },
  };
}

/**
 * Verify user has Google integration connected
 */
export async function verifyGoogleIntegration(userId: string): Promise<
  | { success: true }
  | {
      success: false;
      error: ToolError;
    }
> {
  const hasIntegration = await hasGoogleIntegration(userId);

  if (!hasIntegration) {
    return {
      success: false,
      error: {
        code: "NOT_CONNECTED",
        message:
          "Google account not connected. Please connect your Google account in Settings.",
        action: "reconnect",
      },
    };
  }

  return { success: true };
}

/**
 * Check if user has permission for an action
 * Returns success if permission is "direct"
 * Returns confirmation_required if permission is "confirm"
 */
export async function verifyPermission(
  userId: string,
  permission: PermissionKey,
  actionDetails?: any
): Promise<
  | { success: true }
  | {
      success: false;
      error: ToolError;
      requiresConfirmation?: boolean;
      confirmationData?: any;
    }
> {
  const mode = await checkPermission(userId, permission);

  if (mode === "direct") {
    return { success: true };
  }

  // Permission requires confirmation
  return {
    success: false,
    error: {
      code: "CONFIRMATION_REQUIRED",
      message: "This action requires your confirmation",
      action: "configure_permissions",
    },
    requiresConfirmation: true,
    confirmationData: actionDetails,
  };
}
