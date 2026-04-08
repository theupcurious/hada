import { describe, expect, it } from "vitest";
import {
  getOpenRouterReasoningCapabilities,
  normalizeOpenRouterReasoningEffort,
} from "@/lib/openrouter/reasoning";

describe("normalizeOpenRouterReasoningEffort", () => {
  it("accepts supported effort values and rejects unknown values", () => {
    expect(normalizeOpenRouterReasoningEffort("high")).toBe("high");
    expect(normalizeOpenRouterReasoningEffort(" xhigh ")).toBe("xhigh");
    expect(normalizeOpenRouterReasoningEffort("unsupported")).toBe("");
    expect(normalizeOpenRouterReasoningEffort(undefined)).toBe("");
  });
});

describe("getOpenRouterReasoningCapabilities", () => {
  it("classifies Grok 4.1 as full reasoning with effort support", () => {
    expect(getOpenRouterReasoningCapabilities("x-ai/grok-4.1-fast")).toMatchObject({
      tier: "full",
      supportsReasoningToggle: true,
      supportsPreservedReasoning: true,
      supportsEffort: true,
    });
  });

  it("classifies Qwen, MiniMax, MiMo, and Kimi as full reasoning models", () => {
    expect(getOpenRouterReasoningCapabilities("qwen/qwen3.6-plus")).toMatchObject({
      tier: "full",
      supportsReasoningToggle: true,
      supportsPreservedReasoning: true,
      supportsEffort: false,
    });

    expect(getOpenRouterReasoningCapabilities("minimax/minimax-m2.7")).toMatchObject({
      tier: "full",
      supportsReasoningToggle: true,
      supportsPreservedReasoning: true,
      supportsEffort: false,
    });

    expect(getOpenRouterReasoningCapabilities("xiaomi/mimo-v2-omni")).toMatchObject({
      tier: "full",
      supportsReasoningToggle: true,
      supportsPreservedReasoning: true,
      supportsEffort: false,
    });

    expect(getOpenRouterReasoningCapabilities("moonshotai/kimi-k2.5")).toMatchObject({
      tier: "full",
      supportsReasoningToggle: true,
      supportsPreservedReasoning: true,
      supportsEffort: false,
    });
  });

  it("marks DeepSeek as experimental and GLM as partial", () => {
    expect(getOpenRouterReasoningCapabilities("deepseek/deepseek-v3.2")).toMatchObject({
      tier: "experimental",
      supportsReasoningToggle: true,
      supportsPreservedReasoning: true,
      supportsEffort: false,
    });

    expect(getOpenRouterReasoningCapabilities("z-ai/glm-5.1")).toMatchObject({
      tier: "partial",
      supportsReasoningToggle: true,
      supportsPreservedReasoning: false,
      supportsEffort: false,
    });
  });

  it("returns an unsupported state for unknown models", () => {
    expect(getOpenRouterReasoningCapabilities("openai/gpt-4.1-mini")).toMatchObject({
      tier: "unsupported",
      supportsReasoningToggle: false,
      supportsPreservedReasoning: false,
      supportsEffort: false,
    });
  });
});
