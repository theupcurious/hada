import { createAdminClient, createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret, isEncrypted, isEncryptionConfigured } from "@/lib/crypto/secrets";
import { GOOGLE_OAUTH_CONFIG } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

/**
 * Get Google OAuth tokens for a user from the database
 */
export async function getGoogleTokens(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<GoogleTokens | null> {
  const supabase = supabaseClient ?? (await createClient());

  const { data, error } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, expires_at, scopes")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (error || !data) {
    return null;
  }

  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptSecret(data.access_token);
    refreshToken = decryptSecret(data.refresh_token);
  } catch (err) {
    console.error("Failed to decrypt Google tokens:", err instanceof Error ? err.message : err);
    return null;
  }

  // Rows written before INTEGRATION_ENCRYPTION_KEY existed are plaintext —
  // upgrade them in place the first time they're read.
  if (isEncryptionConfigured() && (!isEncrypted(data.access_token) || !isEncrypted(data.refresh_token))) {
    void supabase
      .from("integrations")
      .update({
        access_token: encryptSecret(accessToken),
        refresh_token: encryptSecret(refreshToken),
      })
      .eq("user_id", userId)
      .eq("provider", "google")
      .then(({ error: upgradeError }) => {
        if (upgradeError) console.error("Failed to re-encrypt Google tokens:", upgradeError.message);
      });
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(data.expires_at),
    scopes: data.scopes,
  };
}

/**
 * Check if an access token is expired (with 5 minute buffer)
 */
export function isTokenExpired(expiresAt: Date): boolean {
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return expiresAt.getTime() - bufferMs < now.getTime();
}

/**
 * Refresh an expired Google access token
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  try {
    const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh Google token:", await response.text());
      return null;
    }

    const data = await response.json();

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    return null;
  }
}

/**
 * Update tokens in the database
 */
export async function updateGoogleTokens(
  userId: string,
  accessToken: string,
  expiresAt: Date,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient ?? (await createClient());

  const { error } = await supabase
    .from("integrations")
    .update({
      access_token: encryptSecret(accessToken),
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");

  if (error) {
    console.error("Error updating Google tokens:", error);
    return false;
  }

  return true;
}

/**
 * Ensure we have a valid access token, refreshing if necessary
 */
export async function ensureValidGoogleToken(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<string | null> {
  const tokens = await getGoogleTokens(userId, supabaseClient);

  if (!tokens) {
    return null;
  }

  // Token is still valid
  if (!isTokenExpired(tokens.expiresAt)) {
    return tokens.accessToken;
  }

  // Token is expired, refresh it
  const refreshed = await refreshGoogleToken(tokens.refreshToken);

  if (!refreshed) {
    // Refresh failed - token likely revoked
    // Mark integration as disconnected by deleting it
    const supabase = supabaseClient ?? (await createClient());
    await supabase
      .from("integrations")
      .delete()
      .eq("user_id", userId)
      .eq("provider", "google");

    return null;
  }

  // Update database with new token
  const updated = await updateGoogleTokens(
    userId,
    refreshed.accessToken,
    refreshed.expiresAt,
    supabaseClient
  );

  if (!updated) {
    return null;
  }

  return refreshed.accessToken;
}

/**
 * Delete Google integration for a user (disconnect)
 */
export async function deleteGoogleIntegration(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient ?? (await createClient());

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");

  if (error) {
    console.error("Error deleting Google integration:", error);
    return false;
  }

  return true;
}

/**
 * Check if user has Google integration connected
 */
export async function hasGoogleIntegration(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const tokens = await getGoogleTokens(userId, supabaseClient);
  return tokens !== null;
}

export async function hasGoogleIntegrationAdmin(userId: string): Promise<boolean> {
  return hasGoogleIntegration(userId, createAdminClient());
}
