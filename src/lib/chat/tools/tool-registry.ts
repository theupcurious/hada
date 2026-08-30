import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";

export type ToolCategory = "memory" | "web" | "calendar" | "communication" | "system" | "custom" | "documents";
export type RiskLevel = "low" | "medium" | "high";

export interface ToolManifest {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  parameters: Record<string, unknown>;
  requiresIntegration?: string;
  riskLevel: RiskLevel;
}

export interface ToolRegistration {
  manifest: ToolManifest;
  create: (context: ToolContext) => AgentTool;
}

/**
 * Tools that a per-space allowlist can never remove — the loop and UX would
 * break without them. Memory keeps the space's scoped memory working, planning
 * and delegation are core agent mechanics, and render_card drives the chat UI.
 * Everything else is "gateable": it appears in the space tool picker and is
 * subject to the allowlist. (delegate_task is safe here — sub-agents draw from
 * the already-filtered tool pool, so a space's restrictions propagate into them.)
 */
export const ALWAYS_ON_TOOL_NAMES: ReadonlySet<string> = new Set([
  "save_memory",
  "recall_memory",
  "plan_task",
  "delegate_task",
  "render_card",
]);

/** A tool the per-space allowlist can restrict (i.e. not an always-on core tool). */
export function isGateableTool(name: string): boolean {
  return !ALWAYS_ON_TOOL_NAMES.has(name);
}

export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();

  register(registration: ToolRegistration) {
    this.tools.set(registration.manifest.name, registration);
  }

  /**
   * Build the live tool set for a context.
   *
   * `allowedTools` is a per-space allowlist of gateable tool names:
   *   - `null`/`undefined` → unrestricted (all tools), the default;
   *   - an array → only those gateable tools are offered (an empty array means
   *     no gateable tools). Always-on core tools (see ALWAYS_ON_TOOL_NAMES) are
   *     offered regardless of the allowlist.
   * Integration gating still applies on top: a tool whose integration is not
   * connected is omitted even if the allowlist includes it.
   */
  getAvailable(
    context: ToolContext,
    connectedIntegrations: string[],
    allowedTools?: readonly string[] | null,
  ): AgentTool[] {
    const integrations = new Set(connectedIntegrations);
    const allowSet = Array.isArray(allowedTools) ? new Set(allowedTools) : null;
    const availableTools: AgentTool[] = [];

    for (const registration of this.tools.values()) {
      const { name, requiresIntegration } = registration.manifest;
      if (requiresIntegration && !integrations.has(requiresIntegration)) {
        continue;
      }
      // Apply the per-space allowlist to gateable tools only.
      if (allowSet && isGateableTool(name) && !allowSet.has(name)) {
        continue;
      }
      const tool = registration.create(context);
      availableTools.push({ ...tool, riskLevel: registration.manifest.riskLevel });
    }

    return availableTools;
  }

  getManifests(connectedIntegrations?: string[]): ToolManifest[] {
    const integrations = connectedIntegrations ? new Set(connectedIntegrations) : null;
    const manifests: ToolManifest[] = [];

    for (const registration of this.tools.values()) {
      if (
        !integrations ||
        !registration.manifest.requiresIntegration ||
        integrations.has(registration.manifest.requiresIntegration)
      ) {
        manifests.push(registration.manifest);
      }
    }

    return manifests;
  }

  getByCategory(): Record<string, ToolManifest[]> {
    const grouped: Record<string, ToolManifest[]> = {};
    for (const registration of this.tools.values()) {
      const cat = registration.manifest.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(registration.manifest);
    }
    return grouped;
  }
}

// Global registry instance
export const registry = new ToolRegistry();
