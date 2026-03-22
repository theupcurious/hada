"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
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
      <header className="flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-zinc-200 px-4 py-3 dark:bg-zinc-900/80 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black dark:bg-white">
              <span className="text-sm font-bold text-white dark:text-black">H</span>
            </div>
            <span className="font-semibold">Hada</span>
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-zinc-500">Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/chat">
            <Button variant="ghost" size="sm">
              Back to Chat
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
