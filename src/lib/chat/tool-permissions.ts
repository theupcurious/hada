import type { MessageSource } from "@/lib/types/database";

export type PermissionDecision = "allow" | "deny" | "confirm";

export interface PermissionPolicy {
  riskDefaults: Record<"low" | "medium" | "high", PermissionDecision>;
  toolOverrides?: Record<string, PermissionDecision>;
  maxCallsPerTool?: Record<string, number>;
  /**
   * Once a tool that returns untrusted external content (web pages, email,
   * Drive files) has run in this turn, these otherwise auto-allowed tools are
   * escalated to `confirm`. This is the prompt-injection tripwire: an
   * instruction planted in fetched content can't silently schedule tasks or
   * put events on the user's calendar without the user seeing it first.
   */
  escalateAfterUntrusted?: readonly string[];
}

/**
 * Tools whose output is fetched from outside the user's own data and may
 * therefore carry injected instructions. Their results are wrapped in an
 * untrusted-content envelope and flip the escalation tripwire above.
 */
export const UNTRUSTED_OUTPUT_TOOLS: ReadonlySet<string> = new Set([
  "web_fetch",
  "web_search",
  "gmail_search",
  "gmail_read",
  "drive_search",
  "drive_read",
  "mcp_call",
]);

export const DEFAULT_POLICY: PermissionPolicy = {
  riskDefaults: {
    low: "allow",
    medium: "allow",
    high: "confirm",
  },
  toolOverrides: {
    // Writes into the user's mailbox on their behalf — always show it first.
    gmail_draft: "confirm",
  },
  maxCallsPerTool: {
    delegate_task: 3,
  },
  escalateAfterUntrusted: ["schedule_task", "create_calendar_event", "update_calendar_event"],
};

/**
 * The confirm flow only exists on the web UI (a pending action is stored on
 * the assistant message and approved from chat). On Telegram and scheduled
 * runs nobody is there to approve, so anything that would `confirm` is denied
 * outright — the model gets a reason string and the run continues, instead of
 * silently stalling.
 */
export function policyForSource(source: MessageSource, base: PermissionPolicy = DEFAULT_POLICY): PermissionPolicy {
  if (source === "web") return base;
  const flip = (d: PermissionDecision): PermissionDecision => (d === "confirm" ? "deny" : d);
  return {
    ...base,
    riskDefaults: {
      low: flip(base.riskDefaults.low),
      medium: flip(base.riskDefaults.medium),
      high: flip(base.riskDefaults.high),
    },
    toolOverrides: Object.fromEntries(
      Object.entries(base.toolOverrides ?? {}).map(([name, d]) => [name, flip(d)]),
    ),
  };
}

export function checkPermission(
  policy: PermissionPolicy,
  toolName: string,
  riskLevel: "low" | "medium" | "high",
  callCountThisRun: number,
  context: { untrustedContentSeen?: boolean } = {},
): PermissionDecision {
  // Tool override takes highest priority
  if (policy.toolOverrides?.[toolName]) {
    return policy.toolOverrides[toolName];
  }

  // Rate limit check
  const maxCalls = policy.maxCallsPerTool?.[toolName];
  if (maxCalls !== undefined && callCountThisRun >= maxCalls) {
    return "deny";
  }

  const decision = policy.riskDefaults[riskLevel];
  if (
    decision === "allow" &&
    context.untrustedContentSeen &&
    policy.escalateAfterUntrusted?.includes(toolName)
  ) {
    // Same non-web caveat as policyForSource: confirm is only actionable on web.
    return policy.riskDefaults.high === "deny" ? "deny" : "confirm";
  }
  return decision;
}
