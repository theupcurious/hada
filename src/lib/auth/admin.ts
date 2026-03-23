const ADMIN_EMAIL_ENV_KEYS = ["ADMIN_USER_EMAILS", "ADMIN_EMAILS"] as const;

function parseAdminEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getAdminEmailAllowlist(): Set<string> {
  for (const key of ADMIN_EMAIL_ENV_KEYS) {
    const raw = process.env[key];
    if (typeof raw === "string" && raw.trim()) {
      return parseAdminEmails(raw);
    }
  }
  return new Set();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return getAdminEmailAllowlist().has(normalized);
}
