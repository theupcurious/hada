"use client";

import { useEffect } from "react";

type ThemeChoice = "dark" | "light" | "system";

function resolveTheme(choice: ThemeChoice): "dark" | "light" {
  if (choice === "dark") return "dark";
  if (choice === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: "dark" | "light") {
  const html = document.documentElement;
  if (resolved === "light") {
    html.dataset.theme = "light";
    html.classList.remove("dark");
  } else {
    delete html.dataset.theme;
    html.classList.add("dark");
  }
}

export function ThemeBootstrap() {
  useEffect(() => {
    const stored = (localStorage.getItem("theme") as ThemeChoice | null) ?? "system";
    const resolved = resolveTheme(stored);
    applyTheme(resolved);

    if (stored !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
