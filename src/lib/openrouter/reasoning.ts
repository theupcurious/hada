import type { OpenRouterReasoningEffort } from "@/lib/types/database";

export const OPENROUTER_DEFAULT_REASONING_MODEL = "minimax/minimax-m2.7";

export type OpenRouterReasoningTier = "full" | "partial" | "experimental" | "unsupported";

export interface OpenRouterReasoningCapabilities {
  tier: OpenRouterReasoningTier;
  label: string;
  description: string;
  supportsReasoningToggle: boolean;
  supportsPreservedReasoning: boolean;
  supportsEffort: boolean;
}

const SUPPORTED_EFFORT_VALUES: OpenRouterReasoningEffort[] = ["low", "medium", "high", "xhigh"];

function normalizeModelId(modelId?: string | null): string {
  return typeof modelId === "string" ? modelId.trim().toLowerCase() : "";
}

function buildCapabilities(params: {
  tier: OpenRouterReasoningTier;
  label: string;
  description: string;
  supportsPreservedReasoning: boolean;
  supportsEffort?: boolean;
}): OpenRouterReasoningCapabilities {
  return {
    tier: params.tier,
    label: params.label,
    description: params.description,
    supportsReasoningToggle: true,
    supportsPreservedReasoning: params.supportsPreservedReasoning,
    supportsEffort: Boolean(params.supportsEffort),
  };
}

export function normalizeOpenRouterReasoningEffort(
  value?: string | null,
): OpenRouterReasoningEffort | "" {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase() as OpenRouterReasoningEffort;
  return SUPPORTED_EFFORT_VALUES.includes(normalized) ? normalized : "";
}

export function getOpenRouterReasoningCapabilities(
  modelId?: string | null,
): OpenRouterReasoningCapabilities {
  const normalized = normalizeModelId(modelId);

  if (!normalized) {
    return {
      tier: "unsupported",
      label: "No model selected",
      description: "Select an OpenRouter model to enable thinking settings.",
      supportsReasoningToggle: false,
      supportsPreservedReasoning: false,
      supportsEffort: false,
    };
  }

  if (normalized.startsWith("x-ai/grok-4.1")) {
    return buildCapabilities({
      tier: "full",
      label: "Full reasoning support",
      description: "Thinking is preserved across tool turns, and effort can be adjusted.",
      supportsPreservedReasoning: true,
      supportsEffort: true,
    });
  }

  if (normalized.startsWith("qwen/qwen3")) {
    return buildCapabilities({
      tier: "full",
      label: "Full reasoning support",
      description: "Thinking is preserved across tool turns.",
      supportsPreservedReasoning: true,
    });
  }

  if (normalized.startsWith("minimax/minimax-m2")) {
    return buildCapabilities({
      tier: "full",
      label: "Full reasoning support",
      description: "Thinking is preserved across tool turns.",
      supportsPreservedReasoning: true,
    });
  }

  if (normalized.startsWith("moonshotai/kimi-k2")) {
    return buildCapabilities({
      tier: "full",
      label: "Full reasoning support",
      description: "Thinking is preserved across tool turns.",
      supportsPreservedReasoning: true,
    });
  }

  if (normalized.startsWith("xiaomi/mimo-v2")) {
    return buildCapabilities({
      tier: "full",
      label: "Full reasoning support",
      description: "Thinking is preserved across tool turns.",
      supportsPreservedReasoning: true,
    });
  }

  if (normalized.startsWith("deepseek/deepseek-v3.2")) {
    return buildCapabilities({
      tier: "experimental",
      label: "Experimental reasoning",
      description: "Thinking is available, but preserved reasoning should be verified in this agent loop.",
      supportsPreservedReasoning: true,
    });
  }

  if (normalized.startsWith("z-ai/glm-5.1")) {
    return buildCapabilities({
      tier: "partial",
      label: "Reasoning only",
      description: "Thinking is available, but preserved reasoning is not currently supported.",
      supportsPreservedReasoning: false,
    });
  }

  return {
    tier: "unsupported",
    label: "No reasoning support",
    description: "This OpenRouter model does not expose thinking settings here.",
    supportsReasoningToggle: false,
    supportsPreservedReasoning: false,
    supportsEffort: false,
  };
}
