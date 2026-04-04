export type PermissionDecision = "allow" | "deny" | "confirm";

export interface PermissionPolicy {
  riskDefaults: Record<"low" | "medium" | "high", PermissionDecision>;
  toolOverrides?: Record<string, PermissionDecision>;
  maxCallsPerTool?: Record<string, number>;
}

export const DEFAULT_POLICY: PermissionPolicy = {
  riskDefaults: {
    low: "allow",
    medium: "allow",
    high: "confirm",
  },
  maxCallsPerTool: {
    delegate_task: 3,
  },
};

export function checkPermission(
  policy: PermissionPolicy,
  toolName: string,
  riskLevel: "low" | "medium" | "high",
  callCountThisRun: number,
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

  return policy.riskDefaults[riskLevel];
}
