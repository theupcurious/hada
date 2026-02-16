import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    { path: "./fonts/geist/geist-100.ttf", weight: "100", style: "normal" },
    { path: "./fonts/geist/geist-200.ttf", weight: "200", style: "normal" },
    { path: "./fonts/geist/geist-300.ttf", weight: "300", style: "normal" },
    { path: "./fonts/geist/geist-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist/geist-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist/geist-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/geist/geist-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/geist/geist-800.ttf", weight: "800", style: "normal" },
    { path: "./fonts/geist/geist-900.ttf", weight: "900", style: "normal" },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    { path: "./fonts/geist-mono/geist-mono-100.ttf", weight: "100", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-200.ttf", weight: "200", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-300.ttf", weight: "300", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-800.ttf", weight: "800", style: "normal" },
    { path: "./fonts/geist-mono/geist-mono-900.ttf", weight: "900", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Hada - Your AI Assistant",
  description: "An intelligent assistant that helps you get things done",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
