"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface IntegrationStatus {
  connected: boolean;
  connectedAt?: string | null;
  lastSync?: string | null;
}

export function IntegrationsTab() {
  const [googleStatus, setGoogleStatus] = useState<IntegrationStatus>({ connected: false });
  const [telegramStatus, setTelegramStatus] = useState<IntegrationStatus>({ connected: false });
  const [telegramDeepLink, setTelegramDeepLink] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    void Promise.all([fetchGoogleStatus(), fetchTelegramStatus()]);
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "google_connected") {
      setMessage({ type: "success", text: "Google account connected successfully." });
      void fetchGoogleStatus();
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      const errorMessages: Record<string, string> = {
        google_oauth_denied: "You denied access to your Google account.",
        invalid_oauth_response: "Invalid OAuth response from Google.",
        invalid_state: "Invalid state parameter. Please try again.",
        not_authenticated: "You must be logged in to connect integrations.",
        token_exchange_failed: "Failed to exchange authorization code.",
        no_refresh_token: "Failed to get refresh token from Google.",
        database_error: "Failed to save integration. Please try again.",
        unknown_error: "An unknown error occurred. Please try again.",
      };
      setMessage({
        type: "error",
        text: errorMessages[error] || "Failed to connect Google account.",
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!telegramDeepLink || telegramStatus.connected) {
      return;
    }

    const interval = setInterval(() => {
      void fetchTelegramStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [telegramDeepLink, telegramStatus.connected]);

  const statusBannerClass = useMemo(
    () =>
      message?.type === "success"
        ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
    [message?.type],
  );

  async function fetchGoogleStatus() {
    try {
      const response = await fetch("/api/integrations/google");
      if (!response.ok) return;
      setGoogleStatus(await response.json());
    } catch (error) {
      console.error("Error fetching Google status:", error);
    }
  }

  async function fetchTelegramStatus() {
    try {
      const response = await fetch("/api/integrations/telegram/link");
      if (!response.ok) return;
      const data = await response.json();
      setTelegramStatus(data);
      if (data.connected) {
        setTelegramDeepLink(null);
      }
    } catch (error) {
      console.error("Error fetching Telegram status:", error);
    }
  }

  function handleGoogleConnect() {
    window.location.href = "/api/auth/google/authorize";
  }

  async function handleGoogleDisconnect() {
    if (!confirm("Are you sure you want to disconnect your Google account?")) return;

    setLoadingGoogle(true);
    try {
      const response = await fetch("/api/integrations/google", { method: "DELETE" });
      if (!response.ok) {
        setMessage({ type: "error", text: "Failed to disconnect Google account." });
        return;
      }
      setGoogleStatus({ connected: false });
      setMessage({ type: "success", text: "Google account disconnected." });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      setMessage({ type: "error", text: "Failed to disconnect Google account." });
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleTelegramConnect() {
    setLoadingTelegram(true);
    try {
      const response = await fetch("/api/integrations/telegram/link", { method: "POST" });
      if (!response.ok) {
        setMessage({ type: "error", text: "Failed to create Telegram link." });
        return;
      }
      const data = await response.json();
      setTelegramDeepLink(data.deepLink || null);
      setMessage({
        type: "success",
        text: "Telegram link generated. Open it and send /start to complete linking.",
      });
    } catch (error) {
      console.error("Error creating Telegram link:", error);
      setMessage({ type: "error", text: "Failed to create Telegram link." });
    } finally {
      setLoadingTelegram(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Connect accounts to unlock calendar, messaging, and automation tools.
        </p>
      </div>

      {message && (
        <div className={`rounded-lg border p-4 ${statusBannerClass}`}>{message.text}</div>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Google</CardTitle>
                  {googleStatus.connected && (
                    <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                  )}
                </div>
                <CardDescription>
                  Connect Google Calendar tools for scheduling and availability checks.
                </CardDescription>
                {googleStatus.lastSync && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Last synced: {new Date(googleStatus.lastSync).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant={googleStatus.connected ? "outline" : "default"}
                onClick={googleStatus.connected ? handleGoogleDisconnect : handleGoogleConnect}
                disabled={loadingGoogle}
              >
                {loadingGoogle ? "..." : googleStatus.connected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Telegram</CardTitle>
                  {telegramStatus.connected && (
                    <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                  )}
                </div>
                <CardDescription>
                  Link Telegram to chat with Hada from your phone and receive scheduled updates.
                </CardDescription>
                {telegramDeepLink && !telegramStatus.connected && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={telegramDeepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Open Telegram link
                    </a>
                    <span className="text-xs text-zinc-400">Waiting for link confirmation...</span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant={telegramStatus.connected ? "outline" : "default"}
                onClick={handleTelegramConnect}
                disabled={loadingTelegram || telegramStatus.connected}
              >
                {loadingTelegram ? "..." : telegramStatus.connected ? "Connected" : "Connect"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
                <CardDescription>Planned integration.</CardDescription>
              </div>
              <Button size="sm" variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Microsoft</CardTitle>
                <CardDescription>Planned integration.</CardDescription>
              </div>
              <Button size="sm" variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
