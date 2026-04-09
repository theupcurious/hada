"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const SETTINGS_LAYOUT_COPY: Record<
  AppLocale,
  {
    section: string;
    backToChatAria: string;
    backToChat: string;
    signOutAria: string;
    signOut: string;
  }
> = {
  en: {
    section: "Settings",
    backToChatAria: "Back to chat",
    backToChat: "Back to Chat",
    signOutAria: "Sign out",
    signOut: "Sign out",
  },
  ko: {
    section: "설정",
    backToChatAria: "채팅으로 돌아가기",
    backToChat: "채팅으로 돌아가기",
    signOutAria: "로그아웃",
    signOut: "로그아웃",
  },
  ja: {
    section: "設定",
    backToChatAria: "チャットに戻る",
    backToChat: "チャットに戻る",
    signOutAria: "サインアウト",
    signOut: "サインアウト",
  },
  zh: {
    section: "设置",
    backToChatAria: "返回聊天",
    backToChat: "返回聊天",
    signOutAria: "退出登录",
    signOut: "退出登录",
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = useResolvedLocale();
  const copy = SETTINGS_LAYOUT_COPY[locale];
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200/80 bg-white/80 px-3 py-3 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/80 sm:px-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link href="/chat" className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden shadow-md shadow-teal-500/20">
                <Image src="/hada-logo.png" alt="Hada" width={24} height={24} className="h-6 w-6 object-cover" />
              </div>
              <span className="font-semibold">Hada</span>
            </Link>
            <span className="hidden text-zinc-300 dark:text-zinc-700 sm:inline">/</span>
            <span className="truncate text-zinc-500">{copy.section}</span>
          </div>
          <div className="flex items-center justify-end gap-1 sm:gap-1.5">
            <ThemeToggle />

            <Link href="/chat" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label={copy.backToChatAria}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/chat" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="px-2.5">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {copy.backToChat}
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label={copy.signOutAria}
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="sm" className="hidden px-2.5 sm:inline-flex" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {copy.signOut}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
