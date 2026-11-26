import type { UserTier } from "@/lib/types/database";

/**
 * Plan limits and the pure allow/deny decision. No server imports, so the
 * Settings UI can share the same numbers.
 *
 * The numbers are placeholders until there is real usage data. "Messages" are
 * assistant runs (one per message you send, regenerate, or workflow run);
 * tokens are a hidden safety cap so one heavy user can't run up the bill
 * inside their message allowance.
 */

export interface PlanLimits {
  label: string;
  monthlyMessages: number;
  monthlyTokens: number;
  activeWorkflows: number;
}

export const PLAN_LIMITS: Record<UserTier, PlanLimits> = {
  free: { label: "Free", monthlyMessages: 100, monthlyTokens: 3_000_000, activeWorkflows: 1 },
  paid: { label: "Plus", monthlyMessages: 1_500, monthlyTokens: 40_000_000, activeWorkflows: 5 },
  pro: { label: "Pro", monthlyMessages: 5_000, monthlyTokens: 150_000_000, activeWorkflows: 20 },
};

export const QUOTA_EXCEEDED_PREFIX = "Plan limit reached:";
export const QUOTA_UNAVAILABLE_PREFIX = "Usage check unavailable:";

export interface UsageTotals {
  runs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type QuotaDenialReason = "messages" | "tokens" | "unavailable";

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: QuotaDenialReason; message: string };

/** Unknown or missing tiers fall back to Free. */
export function normalizeTier(tier: unknown): UserTier {
  return tier === "paid" || tier === "pro" || tier === "free" ? tier : "free";
}

/** Quota periods are calendar months in UTC until billing periods exist. */
export function currentPeriod(now: Date = new Date()): { start: Date; resetsAt: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resetsAt };
}

export function evaluateQuota(options: {
  tier: unknown;
  usage: UsageTotals | null;
  exempt?: boolean;
  resetsAt: Date;
}): QuotaDecision {
  if (options.exempt) {
    return { allowed: true };
  }

  // Fail closed: if usage couldn't be read, don't spend money we can't count.
  if (!options.usage) {
    return {
      allowed: false,
      reason: "unavailable",
      message: `${QUOTA_UNAVAILABLE_PREFIX} Hada couldn’t check your plan usage, so this request wasn’t sent. Try again in a moment.`,
    };
  }

  const tier = normalizeTier(options.tier);
  const limits = PLAN_LIMITS[tier];
  const resets = formatResetDate(options.resetsAt);

  if (options.usage.runs >= limits.monthlyMessages) {
    return {
      allowed: false,
      reason: "messages",
      message: `${QUOTA_EXCEEDED_PREFIX} You’ve used all ${limits.monthlyMessages.toLocaleString("en-US")} messages included in the ${limits.label} plan this month. Your allowance resets on ${resets}.`,
    };
  }

  if (options.usage.inputTokens + options.usage.outputTokens >= limits.monthlyTokens) {
    return {
      allowed: false,
      reason: "tokens",
      message: `${QUOTA_EXCEEDED_PREFIX} You’ve reached the ${limits.label} plan’s monthly processing limit. Your allowance resets on ${resets}.`,
    };
  }

  return { allowed: true };
}

export function formatResetDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

/** The quota message without its machine-readable prefix, for plain-text channels. */
export function stripQuotaPrefix(message: string): string {
  for (const prefix of [QUOTA_EXCEEDED_PREFIX, QUOTA_UNAVAILABLE_PREFIX]) {
    if (message.startsWith(prefix)) return message.slice(prefix.length).trim();
  }
  return message;
}
