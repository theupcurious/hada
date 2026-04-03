import { afterEach, describe, expect, it, vi } from "vitest";
import { callLLMStream, type ProviderSelection } from "@/lib/chat/providers";

describe("Gemini thought signatures in provider stream parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves tool call thought signatures from OpenAI-compatible SSE deltas", async () => {
    const encoder = new TextEncoder();
    const payload = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"list_documents","arguments":"{\\"folder\\":\\"Inbox\\"}"},"extra_content":{"google":{"thought_signature":"sig-a"}}}]}}]}',
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
      provider: "gemini",
      model: "gemini-3-flash",
      apiKey: "test-key",
      config: {
        baseUrl: "https://example.test/v1beta/openai",
        defaultModel: "gemini-3-flash",
      },
    };

    const events = [];
    for await (const event of callLLMStream({
      selection,
      messages: [{ role: "user", content: "List docs" }],
      tools: [
        {
          name: "list_documents",
          description: "List docs",
          parameters: { type: "object", properties: {} },
        },
      ],
    })) {
      events.push(event);
    }

    const done = events.find((event) => event.type === "done");
    expect(done).toBeDefined();
    if (!done || done.type !== "done") {
      throw new Error("expected done event");
    }

    expect(done.toolCalls).toHaveLength(1);
    expect(done.toolCalls[0]).toMatchObject({
      id: "call-1",
      name: "list_documents",
      arguments: { folder: "Inbox" },
      extraContent: {
        google: {
          thought_signature: "sig-a",
        },
      },
    });
  });
});
