"use client";

import { useEffect } from "react";
import { useLocaleContext } from "@/components/i18n/locale-provider";
import { readLocaleCookie, setLocaleCookie, type AppLocale } from "@/lib/i18n";

/**
 * Returns the locale resolved on the server, so client and server markup match.
 * Detecting during render (cookie / `navigator.languages`) produced a hydration
 * mismatch that blanked and re-animated the page on every load.
 */
export function useResolvedLocale(): AppLocale {
  const locale = useLocaleContext();

  // Persist a header-derived locale so later requests resolve it from the cookie.
  useEffect(() => {
    if (!readLocaleCookie()) {
      setLocaleCookie(locale);
    }
  }, [locale]);

  return locale;
}
