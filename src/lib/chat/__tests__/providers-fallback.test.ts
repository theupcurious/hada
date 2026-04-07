import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callLLM,
  resolveProviderSelection,
  type ProviderSelection,
} from "@/lib/chat/providers";
import type { UserSettings } from "@/lib/types/database";

describe("provider fallback resolution", () => {
  const originalEnv = {
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
  };

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.LLM_API_KEY = originalEnv.LLM_API_KEY;
    process.env.LLM_PROVIDER = originalEnv.LLM_PROVIDER;
    process.env.LLM_MODEL = originalEnv.LLM_MODEL;
    process.env.LLM_BASE_URL = originalEnv.LLM_BASE_URL;
  });

  it("uses the user-selected fallback model instead of the provider default", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "fallback reply", tool_calls: [] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const selection: ProviderSelection = {
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
      fallbackModel: "google/gemini-2.5-flash",
      apiKey: "test-key",
      config: {
        baseUrl: "https://openrouter.ai/api/v1",
        defaultModel: "minimax/minimax-m2.7",
        fallbackModel: "moonshotai/kimi-k2.5",
      },
    };

    const result = await callLLM({
      selection,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.content).toBe("fallback reply");

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls;
    expect(fetchCalls).toHaveLength(2);

    const firstPayload = JSON.parse(String(fetchCalls[0]?.[1]?.body));
    const secondPayload = JSON.parse(String(fetchCalls[1]?.[1]?.body));

    expect(firstPayload.model).toBe("openai/gpt-4.1-mini");
    expect(secondPayload.model).toBe("google/gemini-2.5-flash");
    expect(secondPayload.model).not.toBe("moonshotai/kimi-k2.5");
  });

  it("treats a blank explicit fallback setting as no fallback", () => {
    process.env.LLM_API_KEY = "test-key";

    const selection = resolveProviderSelection({
      llm_provider: "openrouter",
      llm_model: "openai/gpt-4.1-mini",
      llm_fallback_model: "",
    } satisfies UserSettings);

    expect(selection.provider).toBe("openrouter");
    expect(selection.model).toBe("openai/gpt-4.1-mini");
    expect(selection.fallbackModel).toBeUndefined();
  });

  it("uses the provider default fallback only when the user has not configured one", () => {
    process.env.LLM_API_KEY = "test-key";

    const selection = resolveProviderSelection({
      llm_provider: "openrouter",
      llm_model: "openai/gpt-4.1-mini",
    } satisfies UserSettings);

    expect(selection.fallbackModel).toBe("moonshotai/kimi-k2.5");
  });
});
