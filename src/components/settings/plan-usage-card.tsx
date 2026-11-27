"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS, formatResetDate, type PlanLimits, type UsageTotals } from "@/lib/usage/plans";

interface UsageStatusResponse {
  tier: string;
  limits: PlanLimits;
  exempt: boolean;
  usage: UsageTotals | null;
  resetsAt: string;
  billingEnabled?: boolean;
}

type BillingAction = "paid" | "pro" | "portal";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; status: UsageStatusResponse };

export function PlanUsageCard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState<BillingAction | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setState({ kind: "ready", status: (await response.json()) as UsageStatusResponse });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("billing");
    let timer: number | undefined;
    if (result === "success") {
      // The webhook usually lands within seconds of the redirect; reload once more.
      queueMicrotask(() => setNotice("Thanks! Your plan will update in a few seconds."));
      timer = window.setTimeout(() => void load(), 4000);
    } else if (result === "cancelled") {
      queueMicrotask(() => setNotice("Checkout was cancelled. You haven’t been charged."));
    }
    void load();
    return () => window.clearTimeout(timer);
  }, [load]);

  const startBilling = async (action: BillingAction) => {
    setBusy(action);
    setBillingError(null);
    try {
      const response = await fetch(action === "portal" ? "/api/billing/portal" : "/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "portal" ? undefined : JSON.stringify({ plan: action }),
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string; portal?: boolean };
      if (response.status === 409 && payload.portal) {
        await startBilling("portal");
        return;
      }
      if (!response.ok || !payload.url) throw new Error(payload.error || "Billing is unavailable right now.");
      window.location.assign(payload.url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Billing is unavailable right now.");
      setBusy(null);
    }
  };

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
        {notice && <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">{notice}</p>}
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
        {status?.billingEnabled && !status.exempt && (
          <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {status.tier === "free" ? (
              (["paid", "pro"] as const).map((plan) => (
                <Button
                  key={plan}
                  size="sm"
                  variant={plan === "paid" ? "default" : "outline"}
                  disabled={busy !== null}
                  onClick={() => void startBilling(plan)}
                >
                  {busy === plan
                    ? "Opening checkout…"
                    : `Upgrade to ${PLAN_LIMITS[plan].label} · ${PLAN_LIMITS[plan].monthlyMessages.toLocaleString("en-US")} messages`}
                </Button>
              ))
            ) : (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void startBilling("portal")}>
                {busy === "portal" ? "Opening billing…" : "Manage billing"}
              </Button>
            )}
          </div>
        )}
        {billingError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{billingError}</p>}
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
