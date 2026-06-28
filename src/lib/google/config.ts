/**
 * Google OAuth Configuration
 *
 * Set up OAuth credentials in Google Cloud Console:
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create OAuth 2.0 Client ID (Web application)
 * 3. Add authorized redirect URI: https://yourdomain.com/api/auth/google/callback
 * 4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables
 */

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    : "http://localhost:3000/api/auth/google/callback",
  scopes: [
    "https://www.googleapis.com/auth/calendar", // Full calendar access
    "https://www.googleapis.com/auth/gmail.modify", // Read/send/draft emails
    "https://www.googleapis.com/auth/drive.readonly", // Read Drive files & Docs
    "https://www.googleapis.com/auth/userinfo.email", // User email address
  ],
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
} as const;

/**
 * Validate Google OAuth configuration
 */
export function validateGoogleConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!GOOGLE_OAUTH_CONFIG.clientId) {
    errors.push("GOOGLE_CLIENT_ID environment variable is not set");
  }

  if (!GOOGLE_OAUTH_CONFIG.clientSecret) {
    errors.push("GOOGLE_CLIENT_SECRET environment variable is not set");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
