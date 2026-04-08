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

describe("agentLoop OpenRouter reasoning replay", () => {
  beforeEach(() => {
    callLLMStreamMock.mockReset();
  });

  it("replays preserved reasoning metadata in assistant history across tool turns", async () => {
    const capturedMessages: Array<Array<Record<string, unknown>>> = [];

    callLLMStreamMock.mockImplementation(async function* (options: { messages: Array<Record<string, unknown>> }) {
      capturedMessages.push(options.messages);

      if (capturedMessages.length === 1) {
        yield {
          type: "done",
          content: "",
          reasoning: "step one",
          reasoning_details: [{ type: "reasoning", text: "step one" }],
          toolCalls: [
            {
              id: "call-1",
              name: "list_documents",
              arguments: { folder: "inbox" },
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
      reasoning: { enabled: true },
      tools: [
        {
          name: "list_documents",
          description: "Lists docs",
          parameters: { type: "object", properties: {} },
          execute: async () => "{\"ok\":true}",
        },
      ],
      provider: {
        provider: "openrouter",
        model: "qwen/qwen3.6-plus",
        fallbackModel: undefined,
        apiKey: "test-key",
        config: {
          baseUrl: "https://openrouter.ai/api/v1",
          defaultModel: "minimax/minimax-m2.7",
          fallbackModel: "moonshotai/kimi-k2.5",
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
    expect(assistantToolCallMessage).toMatchObject({
      reasoning: "step one",
      reasoning_details: [{ type: "reasoning", text: "step one" }],
      tool_calls: [
        {
          id: "call-1",
          type: "function",
          function: {
            name: "list_documents",
            arguments: "{\"folder\":\"inbox\"}",
          },
        },
      ],
    });

    const done = events.find((event) => event.type === "done");
    expect(done).toMatchObject({
      type: "done",
      content: "Done.",
    });
  });
});
