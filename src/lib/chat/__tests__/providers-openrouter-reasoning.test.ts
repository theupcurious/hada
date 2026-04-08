import { afterEach, describe, expect, it, vi } from "vitest";
import { callLLM, callLLMStream, type ProviderSelection } from "@/lib/chat/providers";

describe("OpenRouter reasoning support in provider parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends reasoning config and parses non-streaming reasoning metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Final answer",
                reasoning: "step one",
                reasoning_details: [{ type: "reasoning", text: "step one" }],
                tool_calls: [],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const selection: ProviderSelection = {
      provider: "openrouter",
      model: "x-ai/grok-4.1-fast",
      apiKey: "test-key",
      config: {
        baseUrl: "https://openrouter.ai/api/v1",
        defaultModel: "minimax/minimax-m2.7",
        fallbackModel: "moonshotai/kimi-k2.5",
      },
    };

    const result = await callLLM({
      selection,
      messages: [{ role: "user", content: "hello" }],
      reasoning: { enabled: true, effort: "high" },
    });

    expect(result.content).toBe("Final answer");
    expect(result.reasoning).toBe("step one");
    expect(result.reasoning_details).toEqual([{ type: "reasoning", text: "step one" }]);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const payload = JSON.parse(String(fetchCall?.[1]?.body));
    expect(payload.reasoning).toEqual({ enabled: true, effort: "high" });
  });

  it("preserves streamed reasoning metadata in the done event", async () => {
    const encoder = new TextEncoder();
    const payload = [
      'data: {"choices":[{"delta":{"reasoning":"step one","reasoning_details":[{"type":"reasoning","text":"step one"}],"content":"Final "}}]}',
      'data: {"choices":[{"delta":{"content":"answer."}}]}',
      "data: [DONE]",
      "",
    ].join("\n\n");

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(payload));
        controller.close();
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const selection: ProviderSelection = {
      provider: "openrouter",
      model: "qwen/qwen3.6-plus",
      apiKey: "test-key",
      config: {
        baseUrl: "https://openrouter.ai/api/v1",
        defaultModel: "minimax/minimax-m2.7",
        fallbackModel: "moonshotai/kimi-k2.5",
      },
    };

    const events = [];
    for await (const event of callLLMStream({
      selection,
      messages: [{ role: "user", content: "hello" }],
      reasoning: { enabled: true },
    })) {
      events.push(event);
    }

    const done = events.find((event) => event.type === "done");
    expect(done).toBeDefined();
    if (!done || done.type !== "done") {
      throw new Error("expected done event");
    }

    expect(done.content).toBe("Final answer.");
    expect(done.reasoning).toBe("step one");
    expect(done.reasoning_details).toEqual([{ type: "reasoning", text: "step one" }]);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const payloadSent = JSON.parse(String(fetchCall?.[1]?.body));
    expect(payloadSent.reasoning).toEqual({ enabled: true });
  });

  it("omits reasoning for unsupported OpenRouter models", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Final answer",
                tool_calls: [],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const selection: ProviderSelection = {
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
      apiKey: "test-key",
      config: {
        baseUrl: "https://openrouter.ai/api/v1",
        defaultModel: "minimax/minimax-m2.7",
      },
    };

    await callLLM({
      selection,
      messages: [{ role: "user", content: "hello" }],
      reasoning: { enabled: true, effort: "high" },
    });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const payload = JSON.parse(String(fetchCall?.[1]?.body));
    expect(payload.reasoning).toBeUndefined();
  });
});
