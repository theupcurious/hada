"use client";

import { useEffect, useState } from "react";
import {
  detectPreferredLocale,
  readLocaleCookie,
  setLocaleCookie,
  type AppLocale,
} from "@/lib/i18n";

export function useResolvedLocale(): AppLocale {
  const [locale] = useState<AppLocale>(() => {
    const fromCookie = readLocaleCookie();
    if (fromCookie) {
      return fromCookie;
    }

    if (typeof navigator !== "undefined") {
      return detectPreferredLocale(navigator.languages);
    }

    return "en";
  });

  useEffect(() => {
    setLocaleCookie(locale);

    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return locale;
}
