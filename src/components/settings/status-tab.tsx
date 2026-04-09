"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { useHealthStatus } from "@/lib/hooks/use-health-status";

export function StatusTab() {
  const locale = useResolvedLocale();
  const copy = STATUS_COPY[locale];
  const { status, health, isLoading, error, refresh } = useHealthStatus(10000);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          setIsAdmin(false);
          return;
        }
        const data = (await response.json()) as { isAdmin?: boolean };
        setIsAdmin(Boolean(data.isAdmin));
      } catch {
        setIsAdmin(false);
      }
    };

    void loadRole();
  }, []);

  const statusConfig = {
    connecting: { label: copy.connecting, color: "bg-yellow-500", badgeVariant: "secondary" as const },
    connected: { label: copy.connected, color: "bg-green-500", badgeVariant: "default" as const },
    degraded: { label: copy.degraded, color: "bg-yellow-500", badgeVariant: "secondary" as const },
    disconnected: { label: copy.disconnected, color: "bg-red-500", badgeVariant: "destructive" as const },
  };

  const config = statusConfig[status];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{copy.title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {copy.subtitle}
        </p>
      </div>

      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${config.color} animate-pulse`} />
              <CardTitle className="text-lg">{copy.agentRuntime}</CardTitle>
            </div>
            <Badge variant={config.badgeVariant}>{config.label}</Badge>
          </div>
          <CardDescription>
            {status === "connected" && copy.runtimeReady}
            {status === "degraded" && copy.runtimeLimited}
            {status === "disconnected" && copy.runtimeMissingKey}
            {status === "connecting" && copy.checkingHealth}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Runtime Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.runtimeConnection}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">{copy.status}</span>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${health?.gateway.connected ? "bg-green-500" : "bg-red-500"}`} />
              {health?.gateway.connected ? copy.connected : copy.disconnected}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">{copy.endpoint}</span>
            <code className="max-w-full overflow-x-auto rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
              {health?.gateway.url || "—"}
            </code>
          </div>
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">{copy.lastCheck}</span>
            <span>{health?.gateway.lastCheck ? formatTime(health.gateway.lastCheck, copy) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{copy.llmProvider}</CardTitle>
            <CardDescription>
              {copy.llmProviderDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">{copy.status}</span>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${health?.llmFallback.available ? "bg-green-500" : "bg-zinc-300"}`} />
                {health?.llmFallback.available ? copy.available : copy.notConfigured}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">{copy.provider}</span>
              <span className="capitalize">{health?.llmFallback.provider || "—"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-start sm:justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          {isLoading ? copy.checking : copy.refreshStatus}
        </Button>
      </div>
    </div>
  );
}

function formatTime(isoString: string, copy: StatusCopy): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 5) return copy.justNow;
  if (diffSeconds < 60) return copy.secondsAgo(diffSeconds);
  if (diffSeconds < 3600) return copy.minutesAgo(Math.floor(diffSeconds / 60));
  return date.toLocaleTimeString();
}

type StatusCopy = {
  connecting: string;
  connected: string;
  degraded: string;
  disconnected: string;
  title: string;
  subtitle: string;
  agentRuntime: string;
  runtimeReady: string;
  runtimeLimited: string;
  runtimeMissingKey: string;
  checkingHealth: string;
  runtimeConnection: string;
  status: string;
  endpoint: string;
  lastCheck: string;
  llmProvider: string;
  llmProviderDescription: string;
  available: string;
  notConfigured: string;
  provider: string;
  checking: string;
  refreshStatus: string;
  justNow: string;
  secondsAgo: (s: number) => string;
  minutesAgo: (m: number) => string;
};

const STATUS_COPY: Record<AppLocale, StatusCopy> = {
  en: {
    connecting: "Connecting",
    connected: "Connected",
    degraded: "Degraded",
    disconnected: "Disconnected",
    title: "Status",
    subtitle: "Monitor agent runtime and provider health.",
    agentRuntime: "Agent Runtime",
    runtimeReady: "Your assistant is ready.",
    runtimeLimited: "Runtime available with limited configuration.",
    runtimeMissingKey: "No valid provider key found.",
    checkingHealth: "Checking health...",
    runtimeConnection: "Runtime Connection",
    status: "Status",
    endpoint: "Endpoint",
    lastCheck: "Last Check",
    llmProvider: "LLM Provider",
    llmProviderDescription: "Active provider configuration used by the agent loop.",
    available: "Available",
    notConfigured: "Not Configured",
    provider: "Provider",
    checking: "Checking...",
    refreshStatus: "Refresh Status",
    justNow: "Just now",
    secondsAgo: (s) => `${s}s ago`,
    minutesAgo: (m) => `${m}m ago`,
  },
  ko: {
    connecting: "연결 중",
    connected: "연결됨",
    degraded: "제한 모드",
    disconnected: "연결 끊김",
    title: "상태",
    subtitle: "에이전트 런타임과 제공자 상태를 확인합니다.",
    agentRuntime: "에이전트 런타임",
    runtimeReady: "어시스턴트가 준비되었습니다.",
    runtimeLimited: "제한된 구성으로 런타임을 사용할 수 있습니다.",
    runtimeMissingKey: "유효한 provider key를 찾을 수 없습니다.",
    checkingHealth: "상태 확인 중...",
    runtimeConnection: "런타임 연결",
    status: "상태",
    endpoint: "엔드포인트",
    lastCheck: "마지막 확인",
    llmProvider: "LLM 제공자",
    llmProviderDescription: "에이전트 루프에서 사용하는 활성 제공자 설정입니다.",
    available: "사용 가능",
    notConfigured: "설정되지 않음",
    provider: "제공자",
    checking: "확인 중...",
    refreshStatus: "상태 새로고침",
    justNow: "방금 전",
    secondsAgo: (s) => `${s}초 전`,
    minutesAgo: (m) => `${m}분 전`,
  },
  ja: {
    connecting: "接続中",
    connected: "接続済み",
    degraded: "制限あり",
    disconnected: "未接続",
    title: "ステータス",
    subtitle: "エージェント実行状態とプロバイダーの健全性を確認します。",
    agentRuntime: "エージェントランタイム",
    runtimeReady: "アシスタントの準備ができています。",
    runtimeLimited: "制限付き設定でランタイムが利用可能です。",
    runtimeMissingKey: "有効な provider key が見つかりません。",
    checkingHealth: "ヘルスチェック中...",
    runtimeConnection: "ランタイム接続",
    status: "状態",
    endpoint: "エンドポイント",
    lastCheck: "最終確認",
    llmProvider: "LLM プロバイダー",
    llmProviderDescription: "エージェントループで使用される有効なプロバイダー設定です。",
    available: "利用可能",
    notConfigured: "未設定",
    provider: "プロバイダー",
    checking: "確認中...",
    refreshStatus: "ステータス更新",
    justNow: "たった今",
    secondsAgo: (s) => `${s}秒前`,
    minutesAgo: (m) => `${m}分前`,
  },
  zh: {
    connecting: "连接中",
    connected: "已连接",
    degraded: "受限",
    disconnected: "未连接",
    title: "状态",
    subtitle: "监控代理运行状态和提供商健康情况。",
    agentRuntime: "代理运行时",
    runtimeReady: "你的助手已准备就绪。",
    runtimeLimited: "当前可运行，但配置受限。",
    runtimeMissingKey: "未找到有效的 provider key。",
    checkingHealth: "正在检查状态...",
    runtimeConnection: "运行时连接",
    status: "状态",
    endpoint: "端点",
    lastCheck: "上次检查",
    llmProvider: "LLM 提供商",
    llmProviderDescription: "代理循环当前使用的提供商配置。",
    available: "可用",
    notConfigured: "未配置",
    provider: "提供商",
    checking: "检查中...",
    refreshStatus: "刷新状态",
    justNow: "刚刚",
    secondsAgo: (s) => `${s}秒前`,
    minutesAgo: (m) => `${m}分钟前`,
  },
};
