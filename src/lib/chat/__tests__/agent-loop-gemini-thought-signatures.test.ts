import { describe, expect, it, vi, beforeEach } from "vitest";

const { callLLMStreamMock } = vi.hoisted(() => ({
  callLLMStreamMock: vi.fn(),
}));

vi.mock("@/lib/chat/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/providers")>("@/lib/chat/providers");
  return {
    ...actual,
    callLLMStream: callLLMStreamMock,
  };
});

import { agentLoop } from "@/lib/chat/agent-loop";

describe("agentLoop Gemini thought signature replay", () => {
  beforeEach(() => {
    callLLMStreamMock.mockReset();
  });

  it("replays tool-call thought signatures in assistant history", async () => {
    const capturedMessages: Array<Array<Record<string, unknown>>> = [];

    callLLMStreamMock.mockImplementation(async function* (options: { messages: Array<Record<string, unknown>> }) {
      capturedMessages.push(options.messages);

      if (capturedMessages.length === 1) {
        yield {
          type: "done",
          content: "",
          toolCalls: [
            {
              id: "call-1",
              name: "list_documents",
              arguments: { folder: "inbox" },
              extraContent: {
                google: {
                  thought_signature: "sig-a",
                },
              },
            },
          ],
        };
        return;
      }

      yield { type: "text", chunk: "Done." };
      yield { type: "done", content: "Done.", toolCalls: [] };
    });

    const events = [];
    for await (const event of agentLoop({
      messages: [{ role: "user", content: "List my docs" }],
      systemPrompt: "test",
      tools: [
        {
          name: "list_documents",
          description: "Lists docs",
          parameters: { type: "object", properties: {} },
          execute: async () => "{\"ok\":true}",
        },
      ],
      provider: {
        provider: "gemini",
        model: "gemini-3-flash",
        fallbackModel: undefined,
        apiKey: "test-key",
        config: {
          baseUrl: "https://example.test/v1beta/openai",
          defaultModel: "gemini-3-flash",
        },
      },
      maxIterations: 3,
    })) {
      events.push(event);
    }

    expect(capturedMessages).toHaveLength(2);

    const secondRequestMessages = capturedMessages[1];
    const assistantToolCallMessage = secondRequestMessages.find((msg) => msg.role === "assistant");
    expect(assistantToolCallMessage).toBeDefined();

    const toolCalls = (assistantToolCallMessage?.tool_calls as Array<Record<string, unknown>> | undefined) ?? [];
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({
      id: "call-1",
      type: "function",
      function: {
        name: "list_documents",
        arguments: "{\"folder\":\"inbox\"}",
      },
      extra_content: {
        google: {
          thought_signature: "sig-a",
        },
      },
    });

    expect(events.some((event) => event.type === "done")).toBe(true);
  });
});
