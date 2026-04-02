"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shadow-md shadow-teal-500/20">
                <Image src="/hada-logo.png" alt="Hada" width={32} height={32} className="h-8 w-8 object-cover" />
              </div>
              <span className="font-semibold">Hada</span>
            </Link>
            <span className="hidden text-zinc-300 dark:text-zinc-700 sm:inline">/</span>
            <span className="truncate text-zinc-500">Settings</span>
          </div>
          <div className="flex items-center justify-end gap-1 sm:gap-1.5">
            <ThemeToggle />

            <Link href="/chat" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="Back to chat">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/chat" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="px-2.5">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Chat
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="sm" className="hidden px-2.5 sm:inline-flex" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
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
