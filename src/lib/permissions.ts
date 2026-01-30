import { createClient } from "@/lib/supabase/server";
import type { PermissionMode, UserPermissions } from "@/lib/types/database";

export type PermissionKey =
  | "google_calendar_read"
  | "google_calendar_write"
  | "google_gmail_read"
  | "google_gmail_send";

/**
 * Get user's permissions from database
 */
export async function getUserPermissions(
  userId: string
): Promise<UserPermissions> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("permissions")
    .eq("id", userId)
    .single();

  if (error || !data) {
    // Return default permissions if user not found
    return {
      google_calendar_read: "direct",
      google_calendar_write: "confirm",
      google_gmail_read: "direct",
      google_gmail_send: "confirm",
    };
  }

  return data.permissions || {
    google_calendar_read: "direct",
    google_calendar_write: "confirm",
    google_gmail_read: "direct",
    google_gmail_send: "confirm",
  };
}

/**
 * Check if user has permission for a specific action
 * Returns the permission mode: "direct" or "confirm"
 */
export async function checkPermission(
  userId: string,
  permission: PermissionKey
): Promise<PermissionMode> {
  const permissions = await getUserPermissions(userId);
  return permissions[permission] || "confirm"; // Default to confirm if not set
}

/**
 * Update user's permissions
 */
export async function updateUserPermissions(
  userId: string,
  permissions: Partial<UserPermissions>
): Promise<boolean> {
  const supabase = await createClient();

  // Get existing permissions
  const currentPermissions = await getUserPermissions(userId);

  // Merge with new permissions
  const updatedPermissions = {
    ...currentPermissions,
    ...permissions,
  };

  const { error } = await supabase
    .from("users")
    .update({ permissions: updatedPermissions })
    .eq("id", userId);

  if (error) {
    console.error("Error updating permissions:", error);
    return false;
  }

  return true;
}
