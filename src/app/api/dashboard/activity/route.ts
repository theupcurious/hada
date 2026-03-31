import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") || 50) || 50, 1),
      100,
    );
    const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") || 0) || 0, 0);

    const [{ data: runs, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from("agent_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    if (error || countError) {
      return NextResponse.json(
        { error: error?.message || countError?.message || "Failed to load activity" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        runs: runs || [],
        total: count || 0,
        limit,
        offset,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Dashboard activity API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
