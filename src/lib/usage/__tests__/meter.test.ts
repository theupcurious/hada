import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callLLM, callLLMStream, type ProviderSelection } from "@/lib/chat/providers";
import {
  parseTokenUsage,
  recordUsage,
  runWithUsageContext,
  setUsageAgentRunId,
  setUsageWriterForTests,
} from "@/lib/usage/meter";
import type { UsageEventInsert } from "@/lib/types/database";

const selection: ProviderSelection = {
  provider: "openrouter",
  model: "minimax/minimax-m2.7",
  apiKey: "test-key",
  config: { baseUrl: "https://openrouter.ai/api/v1", defaultModel: "minimax/minimax-m2.7" },
};

function sse(chunks: unknown[]): Response {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("usage meter", () => {
  let rows: UsageEventInsert[];

  beforeEach(() => {
    rows = [];
    setUsageWriterForTests(async (row) => {
      rows.push(row);
    });
  });

  afterEach(() => {
    setUsageWriterForTests(null);
    vi.restoreAllMocks();
  });

  it("parses OpenAI/OpenRouter and Anthropic usage shapes", () => {
    expect(
      parseTokenUsage({
        prompt_tokens: 120,
        completion_tokens: 30,
        prompt_tokens_details: { cached_tokens: 100 },
        cost: 0.00042,
      }),
    ).toEqual({ inputTokens: 120, outputTokens: 30, cachedTokens: 100, costUsd: 0.00042 });

    expect(
      parseTokenUsage({ input_tokens: 50, output_tokens: 10, cache_read_input_tokens: 40 }),
    ).toEqual({ inputTokens: 50, outputTokens: 10, cachedTokens: 40, costUsd: null });

    expect(parseTokenUsage({})).toBeNull();
    expect(parseTokenUsage(null)).toBeNull();
  });

  it("records usage from the final streaming chunk that has no choices", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      sse([
        { choices: [{ delta: { content: "Hel" } }] },
        { choices: [{ delta: { content: "lo" } }] },
        { choices: [], usage: { prompt_tokens: 200, completion_tokens: 5, cost: 0.0011 } },
      ]),
    );

    let text = "";
    await runWithUsageContext({ userId: "user-1", source: "web" }, async () => {
      setUsageAgentRunId("run-1");
      for await (const event of callLLMStream({
        selection,
        messages: [{ role: "user", content: "hi" }],
        purpose: "chat",
      })) {
        if (event.type === "text") text += event.chunk;
      }
    });
    await flush();

    expect(text).toBe("Hello");
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.stream_options).toEqual({ include_usage: true });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      agent_run_id: "run-1",
      kind: "llm",
      purpose: "chat",
      provider: "openrouter",
      model: "minimax/minimax-m2.7",
      input_tokens: 200,
      output_tokens: 5,
      cost_usd: 0.0011,
      estimated: false,
      metadata: { source: "web", streamed: true },
    });
  });

  it("records an estimate when the consumer stops the stream early", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      sse([
        { choices: [{ delta: { content: "a".repeat(40) } }] },
        { choices: [{ delta: { content: "never read" } }] },
        { choices: [], usage: { prompt_tokens: 999, completion_tokens: 999 } },
      ]),
    );

    await runWithUsageContext({ userId: "user-2" }, async () => {
      for await (const event of callLLMStream({ selection, messages: [{ role: "user", content: "x".repeat(80) }] })) {
        if (event.type === "text") break;
      }
    });
    await flush();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "user-2", estimated: true, output_tokens: 10 });
    expect(rows[0].input_tokens).toBeGreaterThanOrEqual(20);
  });

  it("attributes fire-and-forget calls made inside the context", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 10, completion_tokens: 2 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    let background: Promise<unknown> = Promise.resolve();
    await runWithUsageContext({ userId: "user-3" }, async () => {
      background = (async () => {
        await flush();
        return callLLM({ selection, messages: [{ role: "user", content: "hi" }], purpose: "memory_extraction" });
      })();
    });
    await background;
    await flush();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "user-3", purpose: "memory_extraction", input_tokens: 10 });
  });

  it("records with a null user and never throws when there is no context or the writer fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await recordUsage({ kind: "web_search", purpose: "web_search", provider: "tavily" });
    expect(rows[0]).toMatchObject({ user_id: null, kind: "web_search" });
    expect(warn).toHaveBeenCalled();

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setUsageWriterForTests(async () => {
      throw new Error("relation \"usage_events\" does not exist");
    });
    await expect(recordUsage({ kind: "llm", purpose: "chat" })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
