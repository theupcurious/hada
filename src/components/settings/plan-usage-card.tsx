"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatResetDate, type PlanLimits, type UsageTotals } from "@/lib/usage/plans";

interface UsageStatusResponse {
  tier: string;
  limits: PlanLimits;
  exempt: boolean;
  usage: UsageTotals | null;
  resetsAt: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; status: UsageStatusResponse };

export function PlanUsageCard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as UsageStatusResponse;
      })
      .then((status) => {
        if (!cancelled) setState({ kind: "ready", status });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const status = state.kind === "ready" ? state.status : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Plan and usage</CardTitle>
            <CardDescription>
              {status
                ? `Usage this month. Resets on ${formatResetDate(new Date(status.resetsAt))}.`
                : "Your current plan and this month’s usage."}
            </CardDescription>
          </div>
          {status && (
            <Badge variant={status.tier === "free" ? "secondary" : "default"}>{status.limits.label}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.kind === "loading" && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading usage…</p>}
        {state.kind === "error" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Usage couldn’t be loaded. Refresh to try again.</p>
        )}
        {status && !status.usage && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {status.exempt
              ? "Usage tracking isn’t available right now. Admin account: limits don’t apply."
              : "Usage tracking isn’t available right now, so new requests are paused until it’s back."}
          </p>
        )}
        {status?.usage && (
          <>
            <UsageMeter
              label="Messages"
              used={status.usage.runs}
              limit={status.limits.monthlyMessages}
              unlimited={status.exempt}
            />
            <UsageMeter
              label="Processing"
              used={status.usage.inputTokens + status.usage.outputTokens}
              limit={status.limits.monthlyTokens}
              unlimited={status.exempt}
              asPercent
            />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {status.exempt
                ? "Admin account: limits don’t apply."
                : `Includes up to ${status.limits.activeWorkflows} active ${
                    status.limits.activeWorkflows === 1 ? "workflow" : "workflows"
                  }.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UsageMeter({
  label,
  used,
  limit,
  unlimited,
  asPercent,
}: {
  label: string;
  used: number;
  limit: number;
  unlimited?: boolean;
  asPercent?: boolean;
}) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  const percent = Math.round(ratio * 100);
  const value = unlimited
    ? asPercent
      ? `${used.toLocaleString("en-US")} tokens`
      : used.toLocaleString("en-US")
    : asPercent
      ? `${percent}% used`
      : `${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      {!unlimited && (
        <div
          role="progressbar"
          aria-label={`${label} used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              ratio >= 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-zinc-900 dark:bg-zinc-100",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
