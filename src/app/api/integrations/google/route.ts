import { createClient } from "@/lib/supabase/server";
import { deleteGoogleIntegration } from "@/lib/google/tokens";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

/**
 * GET - Check if user has Google integration connected
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("integrations")
      .select("created_at, updated_at, scopes")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single();

    if (error || !data) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      connectedAt: data.created_at,
      lastSync: data.updated_at,
      scopes: data.scopes,
    });
  } catch (error) {
    console.error("Error checking Google integration:", error);
    return NextResponse.json(
      { error: "Failed to check integration status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Disconnect Google integration
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const success = await deleteGoogleIntegration(user.id);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to disconnect integration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Google integration:", error);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
