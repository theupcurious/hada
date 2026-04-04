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

export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();

  register(registration: ToolRegistration) {
    this.tools.set(registration.manifest.name, registration);
  }

  getAvailable(context: ToolContext, connectedIntegrations: string[]): AgentTool[] {
    const integrations = new Set(connectedIntegrations);
    const availableTools: AgentTool[] = [];

    for (const registration of this.tools.values()) {
      if (
        !registration.manifest.requiresIntegration ||
        integrations.has(registration.manifest.requiresIntegration)
      ) {
        const tool = registration.create(context);
        availableTools.push({ ...tool, riskLevel: registration.manifest.riskLevel });
      }
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
