"use client";

export const dynamic = "force-dynamic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusTab } from "@/components/settings/status-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AccountTab } from "@/components/settings/account-tab";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Sidebar for desktop */}
      <Tabs defaultValue="status" className="flex h-full w-full" orientation="vertical">
        {/* Desktop sidebar */}
        <div className="hidden md:flex w-56 shrink-0 flex-col border-r border-border/80 bg-card/70 p-4 backdrop-blur-sm">
          <TabsList className="flex flex-col h-auto bg-transparent gap-1">
            <TabsTrigger
              value="status"
              className="w-full justify-start px-3 py-2 text-left data-[state=active]:bg-muted"
            >
              <StatusIcon className="mr-2 h-4 w-4" />
              Status
            </TabsTrigger>
            <TabsTrigger
              value="integrations"
              className="w-full justify-start px-3 py-2 text-left data-[state=active]:bg-muted"
            >
              <IntegrationsIcon className="mr-2 h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="w-full justify-start px-3 py-2 text-left data-[state=active]:bg-muted"
            >
              <AccountIcon className="mr-2 h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden w-full border-b border-border/80 bg-card/70 px-4 backdrop-blur-sm">
          <TabsList className="w-full justify-start bg-transparent">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            <TabsContent value="status" className="mt-0">
              <StatusTab />
            </TabsContent>
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsTab />
            </TabsContent>
            <TabsContent value="account" className="mt-0">
              <AccountTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function StatusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IntegrationsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}
