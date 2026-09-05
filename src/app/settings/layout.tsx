"use client";
import { AppHeader } from "@/components/app/app-header";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const locale = useResolvedLocale();
  const signOut = async () => { await createClient().auth.signOut(); router.push("/"); };
  return <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
    <AppHeader><ThemeToggle /><Button variant="ghost" size="sm" onClick={() => void signOut()}>{ { en: "Sign out", ko: "로그아웃", ja: "サインアウト", zh: "退出登录" }[locale] }</Button></AppHeader>
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>;
}
