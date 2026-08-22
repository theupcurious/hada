import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { ThemeBootstrap } from "@/components/theme/theme-bootstrap";
import { LOCALE_COOKIE_NAME, resolveRequestLocale } from "@/lib/i18n";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Hada - Your AI Assistant",
  description: "An intelligent assistant that helps you get things done",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveRequestLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerList.get("accept-language"),
  );

  return (
    <html lang={locale} className="dark">
      <body
        className={`${dmSans.variable} ${plusJakarta.variable} font-sans antialiased`}
      >
        <ThemeBootstrap />
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
