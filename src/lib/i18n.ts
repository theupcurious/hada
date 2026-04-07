export const LOCALE_COOKIE_NAME = "hada_locale";
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const APP_LOCALES = ["en", "ko", "ja"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const APP_LOCALE_OPTIONS: Array<{ value: AppLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "ko", label: "Korean (한국어)" },
  { value: "ja", label: "Japanese (日本語)" },
];

export function normalizeLocale(value: unknown, fallback: AppLocale = "en"): AppLocale {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized === "ko" || normalized.startsWith("ko-")) {
    return "ko";
  }
  if (normalized === "ja" || normalized.startsWith("ja-")) {
    return "ja";
  }
  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  return fallback;
}

export function detectPreferredLocale(languages: readonly string[] | null | undefined): AppLocale {
  if (!Array.isArray(languages) || languages.length === 0) {
    return "en";
  }

  for (const language of languages) {
    const locale = normalizeLocale(language, "en");
    if (locale !== "en") {
      return locale;
    }
  }

  return normalizeLocale(languages[0], "en");
}

export function toLocaleLanguageTag(locale: AppLocale): string {
  switch (locale) {
    case "ko":
      return "ko-KR";
    case "ja":
      return "ja-JP";
    case "en":
    default:
      return "en-US";
  }
}

export function setLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function parseLocaleFromCookieHeader(cookieHeader: string): AppLocale | null {
  if (!cookieHeader) {
    return null;
  }

  const entries = cookieHeader.split(";");
  for (const entry of entries) {
    const [rawKey, ...rest] = entry.trim().split("=");
    if (rawKey !== LOCALE_COOKIE_NAME) {
      continue;
    }

    const rawValue = rest.join("=");
    if (!rawValue) {
      return null;
    }

    return normalizeLocale(decodeURIComponent(rawValue));
  }

  return null;
}

export function readLocaleCookie(): AppLocale | null {
  if (typeof document === "undefined") {
    return null;
  }

  return parseLocaleFromCookieHeader(document.cookie);
}
