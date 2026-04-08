import { NextRequest, NextResponse } from "next/server";
import { loadBackgroundJobForUser } from "@/lib/background-jobs";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const afterSeq = Math.max(Number(request.nextUrl.searchParams.get("after") || 0) || 0, 0);
    const payload = await loadBackgroundJobForUser({
      supabase,
      userId: user.id,
      jobId: params.id,
      afterSeq,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Background job poll API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
