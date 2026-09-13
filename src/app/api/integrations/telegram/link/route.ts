import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { buildTelegramDeepLink, createTelegramLinkToken } from "@/lib/telegram/linking";

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabase
      .from("integrations")
      .select("created_at, updated_at")
      .eq("user_id", user.id)
      .eq("provider", "telegram")
      .single();

    return NextResponse.json({
      connected: Boolean(data),
      connectedAt: data?.created_at || null,
      lastSync: data?.updated_at || null,
    });
  } catch (error) {
    console.error("Telegram status error:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await checkRateLimit(RATE_LIMITS.telegramLink, user.id);
    if (!limit.allowed) {
      return rateLimitedResponse(limit);
    }

    const { token, expiresAt } = await createTelegramLinkToken({
      supabase,
      userId: user.id,
    });

    return NextResponse.json({
      token,
      expiresAt,
      deepLink: buildTelegramDeepLink(token),
    });
  } catch (error) {
    console.error("Telegram link token error:", error);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
