import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getUsageStatus } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

/** The signed-in user's plan, limits, and usage for the current month. */
export async function GET() {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getUsageStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Usage status failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn’t load usage" }, { status: 500 });
  }
}
