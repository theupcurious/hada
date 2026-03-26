import { NextRequest, NextResponse } from "next/server";
import { processBackgroundJob } from "@/lib/background-jobs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const token = request.nextUrl.searchParams.get("token") || undefined;
    const result = await processBackgroundJob(params.id, token);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Background job run API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
