import { createClient } from "@/lib/supabase/server";
import { GOOGLE_OAUTH_CONFIG, validateGoogleConfig } from "@/lib/google/config";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

/**
 * Initiate Google OAuth flow
 * Redirects user to Google consent screen
 */
export async function GET() {
  try {
    // Validate configuration
    const configValidation = validateGoogleConfig();
    if (!configValidation.valid) {
      return NextResponse.json(
        {
          error: "Google OAuth not configured",
          details: configValidation.errors,
        },
        { status: 500 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.redirect(new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
    }

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Store state in cookie (expires in 10 minutes)
    const cookieStore = await cookies();
    cookieStore.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Build authorization URL
    const authUrl = new URL(GOOGLE_OAUTH_CONFIG.authUrl);
    authUrl.searchParams.set("client_id", GOOGLE_OAUTH_CONFIG.clientId);
    authUrl.searchParams.set("redirect_uri", GOOGLE_OAUTH_CONFIG.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_OAUTH_CONFIG.scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline"); // Get refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token

    // Redirect to Google
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Google OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
