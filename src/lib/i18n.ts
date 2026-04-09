export const LOCALE_COOKIE_NAME = "hada_locale";
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const APP_LOCALES = ["en", "ko", "ja", "zh"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const APP_LOCALE_OPTIONS: Array<{ value: AppLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "ko", label: "Korean (한국어)" },
  { value: "ja", label: "Japanese (日本語)" },
  { value: "zh", label: "Chinese (中文)" },
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
  if (
    normalized === "zh" ||
    normalized.startsWith("zh-") ||
    normalized === "cmn" ||
    normalized.startsWith("cmn-")
  ) {
    return "zh";
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
    case "zh":
      return "zh-CN";
    case "en":
    default:
      return "en-US";
  }
}

export function detectMessageLocale(text: string): AppLocale | null {
  const input = text.trim();
  if (!input) {
    return null;
  }

  const hangulCount = countMatches(input, /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/g);
  if (hangulCount >= 2) {
    return "ko";
  }

  const kanaCount = countMatches(input, /[\u3040-\u309F\u30A0-\u30FF]/g);
  if (kanaCount >= 1) {
    return "ja";
  }

  const hanCount = countMatches(input, /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g);
  const chineseSignalCount =
    countMatches(input, /[，。！？；：「」『』（）【】《》]/g) +
    countMatches(input, /[的了在是我你他她它们們这這那哪吗嗎呢吧请請帮幫给給对對会會想要]/g);
  if (hanCount >= 2 && chineseSignalCount >= 1) {
    return "zh";
  }

  const latinCount = countMatches(input, /[A-Za-z]/g);
  if (latinCount >= 4 && latinCount >= hanCount * 2) {
    return "en";
  }

  if (hanCount >= 4) {
    return "zh";
  }

  return null;
}

export function resolveTurnLocale(
  text: string,
  fallbackLocale: AppLocale,
): { locale: AppLocale; source: "settings" | "message" } {
  const detectedLocale = detectMessageLocale(text);
  if (detectedLocale && detectedLocale !== fallbackLocale) {
    return {
      locale: detectedLocale,
      source: "message",
    };
  }

  return {
    locale: fallbackLocale,
    source: "settings",
  };
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
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
