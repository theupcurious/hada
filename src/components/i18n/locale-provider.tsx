"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { LOCALE_CHANGE_EVENT, readLocaleCookie, type AppLocale } from "@/lib/i18n";

const LocaleContext = createContext<AppLocale>("en");

/**
 * Holds the locale resolved on the server (cookie, then `Accept-Language`).
 *
 * The server-resolved value is what renders, so the server and client markup
 * always agree — resolving the locale during client render instead causes a
 * hydration mismatch that discards and re-renders the whole tree.
 */
export function LocaleProvider({
  locale: serverLocale,
  children,
}: {
  locale: AppLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<AppLocale>(serverLocale);

  useEffect(() => {
    setLocale(serverLocale);
  }, [serverLocale]);

  // `setLocaleCookie` announces changes so a language switch applies without a reload.
  useEffect(() => {
    function syncFromCookie() {
      const fromCookie = readLocaleCookie();
      if (fromCookie) {
        setLocale(fromCookie);
      }
    }

    window.addEventListener(LOCALE_CHANGE_EVENT, syncFromCookie);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, syncFromCookie);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext(): AppLocale {
  return useContext(LocaleContext);
}
