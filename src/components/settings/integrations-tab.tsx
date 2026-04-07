"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";

interface IntegrationStatus {
  connected: boolean;
  connectedAt?: string | null;
  lastSync?: string | null;
}

export function IntegrationsTab() {
  const locale = useResolvedLocale();
  const copy = INTEGRATIONS_COPY[locale];
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
      setMessage({ type: "success", text: copy.googleConnected });
      void fetchGoogleStatus();
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      const errorMessages: Record<string, string> = copy.googleErrorMessages;
      setMessage({
        type: "error",
        text: errorMessages[error] || copy.googleConnectFailed,
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, [copy.googleConnectFailed, copy.googleConnected, copy.googleErrorMessages, searchParams]);

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
    if (!confirm(copy.confirmGoogleDisconnect)) return;

    setLoadingGoogle(true);
    try {
      const response = await fetch("/api/integrations/google", { method: "DELETE" });
      if (!response.ok) {
        setMessage({ type: "error", text: copy.googleDisconnectFailed });
        return;
      }
      setGoogleStatus({ connected: false });
      setMessage({ type: "success", text: copy.googleDisconnected });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      setMessage({ type: "error", text: copy.googleDisconnectFailed });
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleTelegramConnect() {
    setLoadingTelegram(true);
    try {
      const response = await fetch("/api/integrations/telegram/link", { method: "POST" });
      if (!response.ok) {
        setMessage({ type: "error", text: copy.telegramLinkFailed });
        return;
      }
      const data = await response.json();
      setTelegramDeepLink(data.deepLink || null);
      setMessage({
        type: "success",
        text: copy.telegramLinkCreated,
      });
    } catch (error) {
      console.error("Error creating Telegram link:", error);
      setMessage({ type: "error", text: copy.telegramLinkFailed });
    } finally {
      setLoadingTelegram(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{copy.title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {copy.subtitle}
        </p>
      </div>

      {message && (
        <div className={`rounded-lg border p-4 ${statusBannerClass}`}>{message.text}</div>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Google</CardTitle>
                  {googleStatus.connected && (
                    <span className="text-xs text-green-600 dark:text-green-400">{copy.connected}</span>
                  )}
                </div>
                <CardDescription>
                  {copy.googleDescription}
                </CardDescription>
                {googleStatus.lastSync && (
                  <p className="mt-1 text-xs text-zinc-400">
                    {copy.lastSynced}: {new Date(googleStatus.lastSync).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant={googleStatus.connected ? "outline" : "default"}
                className="w-full sm:w-auto"
                onClick={googleStatus.connected ? handleGoogleDisconnect : handleGoogleConnect}
                disabled={loadingGoogle}
              >
                {loadingGoogle ? "..." : googleStatus.connected ? copy.disconnect : copy.connect}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Telegram</CardTitle>
                  {telegramStatus.connected && (
                    <span className="text-xs text-green-600 dark:text-green-400">{copy.connected}</span>
                  )}
                </div>
                <CardDescription>
                  {copy.telegramDescription}
                </CardDescription>
                {telegramDeepLink && !telegramStatus.connected && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={telegramDeepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {copy.openTelegramLink}
                    </a>
                    <span className="text-xs text-zinc-400">{copy.waitingForConfirmation}</span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant={telegramStatus.connected ? "outline" : "default"}
                className="w-full sm:w-auto"
                onClick={handleTelegramConnect}
                disabled={loadingTelegram || telegramStatus.connected}
              >
                {loadingTelegram ? "..." : telegramStatus.connected ? copy.connected : copy.connect}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
                <CardDescription>{copy.plannedIntegration}</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled>
                {copy.comingSoon}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Microsoft</CardTitle>
                <CardDescription>{copy.plannedIntegration}</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled>
                {copy.comingSoon}
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

const INTEGRATIONS_COPY: Record<
  AppLocale,
  {
    title: string;
    subtitle: string;
    connected: string;
    connect: string;
    disconnect: string;
    googleDescription: string;
    telegramDescription: string;
    lastSynced: string;
    plannedIntegration: string;
    comingSoon: string;
    openTelegramLink: string;
    waitingForConfirmation: string;
    confirmGoogleDisconnect: string;
    googleConnected: string;
    googleDisconnected: string;
    googleConnectFailed: string;
    googleDisconnectFailed: string;
    telegramLinkFailed: string;
    telegramLinkCreated: string;
    googleErrorMessages: Record<string, string>;
  }
> = {
  en: {
    title: "Integrations",
    subtitle: "Connect accounts to unlock calendar, messaging, and automation tools.",
    connected: "Connected",
    connect: "Connect",
    disconnect: "Disconnect",
    googleDescription: "Connect Google Calendar tools for scheduling and availability checks.",
    telegramDescription: "Link Telegram to chat with Hada from your phone and receive scheduled updates.",
    lastSynced: "Last synced",
    plannedIntegration: "Planned integration.",
    comingSoon: "Coming Soon",
    openTelegramLink: "Open Telegram link",
    waitingForConfirmation: "Waiting for link confirmation...",
    confirmGoogleDisconnect: "Are you sure you want to disconnect your Google account?",
    googleConnected: "Google account connected successfully.",
    googleDisconnected: "Google account disconnected.",
    googleConnectFailed: "Failed to connect Google account.",
    googleDisconnectFailed: "Failed to disconnect Google account.",
    telegramLinkFailed: "Failed to create Telegram link.",
    telegramLinkCreated: "Telegram link generated. Open it and send /start to complete linking.",
    googleErrorMessages: {
      google_oauth_denied: "You denied access to your Google account.",
      invalid_oauth_response: "Invalid OAuth response from Google.",
      invalid_state: "Invalid state parameter. Please try again.",
      not_authenticated: "You must be logged in to connect integrations.",
      token_exchange_failed: "Failed to exchange authorization code.",
      no_refresh_token: "Failed to get refresh token from Google.",
      database_error: "Failed to save integration. Please try again.",
      unknown_error: "An unknown error occurred. Please try again.",
    },
  },
  ko: {
    title: "연동",
    subtitle: "계정을 연결해 캘린더, 메시징, 자동화 기능을 활성화하세요.",
    connected: "연결됨",
    connect: "연결",
    disconnect: "연결 해제",
    googleDescription: "일정 관리와 가능 시간 확인을 위해 Google Calendar를 연결합니다.",
    telegramDescription: "Telegram을 연결해 휴대폰에서도 Hada와 대화하고 예약 업데이트를 받으세요.",
    lastSynced: "마지막 동기화",
    plannedIntegration: "추후 연동 예정입니다.",
    comingSoon: "곧 제공",
    openTelegramLink: "Telegram 링크 열기",
    waitingForConfirmation: "연동 확인을 기다리는 중...",
    confirmGoogleDisconnect: "Google 계정 연결을 해제하시겠습니까?",
    googleConnected: "Google 계정이 연결되었습니다.",
    googleDisconnected: "Google 계정 연결이 해제되었습니다.",
    googleConnectFailed: "Google 계정 연결에 실패했습니다.",
    googleDisconnectFailed: "Google 계정 연결 해제에 실패했습니다.",
    telegramLinkFailed: "Telegram 링크 생성에 실패했습니다.",
    telegramLinkCreated: "Telegram 링크가 생성되었습니다. 열어서 /start 를 보내 연동을 완료하세요.",
    googleErrorMessages: {
      google_oauth_denied: "Google 계정 접근 권한이 거부되었습니다.",
      invalid_oauth_response: "Google OAuth 응답이 올바르지 않습니다.",
      invalid_state: "state 파라미터가 올바르지 않습니다. 다시 시도해 주세요.",
      not_authenticated: "연동하려면 먼저 로그인해야 합니다.",
      token_exchange_failed: "인증 코드 교환에 실패했습니다.",
      no_refresh_token: "Google에서 refresh token을 받지 못했습니다.",
      database_error: "연동 정보를 저장하지 못했습니다. 다시 시도해 주세요.",
      unknown_error: "알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.",
    },
  },
  ja: {
    title: "連携",
    subtitle: "アカウントを接続して、カレンダー・メッセージ・自動化機能を有効化します。",
    connected: "接続済み",
    connect: "接続",
    disconnect: "切断",
    googleDescription: "スケジュール調整と空き時間確認のために Google Calendar を連携します。",
    telegramDescription: "Telegram を連携して、スマホから Hada と会話し、定期更新を受け取れます。",
    lastSynced: "最終同期",
    plannedIntegration: "今後対応予定です。",
    comingSoon: "近日公開",
    openTelegramLink: "Telegram リンクを開く",
    waitingForConfirmation: "連携確認を待機中...",
    confirmGoogleDisconnect: "Google アカウントの連携を解除しますか？",
    googleConnected: "Google アカウントを接続しました。",
    googleDisconnected: "Google アカウントの接続を解除しました。",
    googleConnectFailed: "Google アカウントの接続に失敗しました。",
    googleDisconnectFailed: "Google アカウントの切断に失敗しました。",
    telegramLinkFailed: "Telegram リンクの作成に失敗しました。",
    telegramLinkCreated: "Telegram リンクを生成しました。開いて /start を送信し連携を完了してください。",
    googleErrorMessages: {
      google_oauth_denied: "Google アカウントへのアクセスが拒否されました。",
      invalid_oauth_response: "Google からの OAuth 応答が無効です。",
      invalid_state: "state パラメータが無効です。再試行してください。",
      not_authenticated: "連携するにはログインが必要です。",
      token_exchange_failed: "認可コードの交換に失敗しました。",
      no_refresh_token: "Google から refresh token を取得できませんでした。",
      database_error: "連携情報の保存に失敗しました。再試行してください。",
      unknown_error: "不明なエラーが発生しました。再試行してください。",
    },
  },
};
