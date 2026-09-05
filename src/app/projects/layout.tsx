import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/app-header";

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950"><AppHeader />{children}</div>;
}
