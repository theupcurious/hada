import { NextRequest, NextResponse } from "next/server";
import { patchMessageMetadata } from "@/lib/db/conversations";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { user } = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const value = body?.value === "up" || body?.value === "down" ? body.value : null;

  if (!value) {
    return NextResponse.json({ error: "Feedback value is required" }, { status: 400 });
  }

  const params = await context.params;
  try {
    const message = await patchMessageMetadata(supabase, params.id, {
      feedback: { value, updated_at: new Date().toISOString() },
    });
    return NextResponse.json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg === "Message not found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
