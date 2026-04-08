import { createClient } from "@/lib/supabase/server";
import { GOOGLE_OAUTH_CONFIG } from "@/lib/google/config";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

/**
 * Handle Google OAuth callback
 * Exchange authorization code for tokens and store in database
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = new URL("/settings", baseUrl);

  try {
    // Handle OAuth errors (user denied permission, etc.)
    if (error) {
      settingsUrl.searchParams.set("error", "google_oauth_denied");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Validate required parameters
    if (!code || !state) {
      settingsUrl.searchParams.set("error", "invalid_oauth_response");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Verify state token (CSRF protection)
    const cookieStore = await cookies();
    const savedState = cookieStore.get("google_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      settingsUrl.searchParams.set("error", "invalid_state");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Clear state cookie
    cookieStore.delete("google_oauth_state");

    // Verify user is authenticated
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      settingsUrl.searchParams.set("error", "not_authenticated");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      settingsUrl.searchParams.set("error", "token_exchange_failed");
      return NextResponse.redirect(settingsUrl.toString());
    }

    const tokenData = await tokenResponse.json();

    // Validate we got a refresh token (should always get one with prompt=consent)
    if (!tokenData.refresh_token) {
      console.error("No refresh token received from Google");
      settingsUrl.searchParams.set("error", "no_refresh_token");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Calculate token expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Store tokens in database (upsert in case user is reconnecting)
    const { error: dbError } = await supabase
      .from("integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "google",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          scopes: tokenData.scope ? tokenData.scope.split(" ") : GOOGLE_OAUTH_CONFIG.scopes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (dbError) {
      console.error("Database error storing tokens:", dbError);
      settingsUrl.searchParams.set("error", "database_error");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // Success! Redirect back to settings
    settingsUrl.searchParams.set("success", "google_connected");
    return NextResponse.redirect(settingsUrl.toString());
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);
    settingsUrl.searchParams.set("error", "unknown_error");
    return NextResponse.redirect(settingsUrl.toString());
  }
}
