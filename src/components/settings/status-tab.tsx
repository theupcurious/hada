"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHealthStatus } from "@/lib/hooks/use-health-status";

export function StatusTab() {
  const { status, health, isLoading, error, refresh } = useHealthStatus(10000);

  const statusConfig = {
    connecting: { label: "Connecting", color: "bg-yellow-500", badgeVariant: "secondary" as const },
    connected: { label: "Connected", color: "bg-green-500", badgeVariant: "default" as const },
    degraded: { label: "Degraded", color: "bg-yellow-500", badgeVariant: "secondary" as const },
    disconnected: { label: "Disconnected", color: "bg-red-500", badgeVariant: "destructive" as const },
  };

  const config = statusConfig[status];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Status</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Monitor your bot server connection and health.
        </p>
      </div>

      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${config.color} animate-pulse`} />
              <CardTitle className="text-lg">Bot Server</CardTitle>
            </div>
            <Badge variant={config.badgeVariant}>{config.label}</Badge>
          </div>
          <CardDescription>
            {status === "connected" && "Your assistant is ready and connected to the gateway."}
            {status === "degraded" && "Gateway unavailable. Using fallback LLM provider."}
            {status === "disconnected" && "Unable to connect. Please check your configuration."}
            {status === "connecting" && "Establishing connection..."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Gateway Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Status</span>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${health?.gateway.connected ? "bg-green-500" : "bg-red-500"}`} />
              {health?.gateway.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">URL</span>
            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
              {health?.gateway.url || "—"}
            </code>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Last Check</span>
            <span>{health?.gateway.lastCheck ? formatTime(health.gateway.lastCheck) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* LLM Fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LLM Fallback</CardTitle>
          <CardDescription>
            Direct LLM provider used when gateway is unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Status</span>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${health?.llmFallback.available ? "bg-green-500" : "bg-zinc-300"}`} />
              {health?.llmFallback.available ? "Available" : "Not Configured"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Provider</span>
            <span className="capitalize">{health?.llmFallback.provider || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          {isLoading ? "Checking..." : "Refresh Status"}
        </Button>
      </div>
    </div>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 5) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return date.toLocaleTimeString();
}
