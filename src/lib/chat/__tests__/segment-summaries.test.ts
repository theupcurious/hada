import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSegmentAwareCompactionPlan } from "@/lib/chat/context-manager";
import {
  queueSegmentSummaryRefresh,
  refreshSegmentSummary,
  shouldRefreshSegmentSummary,
} from "@/lib/chat/segment-summaries";
import { callLLM } from "@/lib/chat/providers";
import { generateEmbedding } from "@/lib/chat/embeddings";

vi.mock("@/lib/chat/providers", () => ({
  callLLM: vi.fn(),
}));

vi.mock("@/lib/chat/embeddings", () => ({
  generateEmbedding: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shouldRefreshSegmentSummary", () => {
  it("refreshes closed segments and stale revived segments", () => {
    const now = Date.parse("2026-04-09T12:00:00Z");
    const freshSegment = {
      id: "seg-1",
      conversation_id: "conv-1",
      user_id: "user-1",
      status: "active" as const,
      title: "Planning",
      summary: "Existing summary",
      summary_embedding: null,
      topic_key: "planning",
      opened_at: "2026-04-08T00:00:00Z",
      closed_at: null,
      last_active_at: "2026-04-09T11:00:00Z",
      message_count: 10,
      metadata: {
        summary_refreshed_at: "2026-04-09T11:30:00Z",
        summary_message_count: 10,
        summary_last_message_at: "2026-04-09T11:00:00Z",
      },
    };

    expect(shouldRefreshSegmentSummary(freshSegment, { now })).toEqual(
      expect.objectContaining({ shouldRefresh: false, reason: "fresh_enough", stale: false }),
    );

    const closedSegment = {
      ...freshSegment,
      status: "closed" as const,
      summary: null,
      metadata: {},
    };

    expect(shouldRefreshSegmentSummary(closedSegment, { now, reason: "closed" })).toEqual(
      expect.objectContaining({ shouldRefresh: true, reason: "closed_new", hasSummary: false }),
    );

    const revivedSegment = {
      ...freshSegment,
      metadata: {
        summary_refreshed_at: "2026-04-08T10:00:00Z",
        summary_message_count: 8,
        summary_last_message_at: "2026-04-08T10:00:00Z",
      },
    };

    expect(shouldRefreshSegmentSummary(revivedSegment, { now, reason: "revived" })).toEqual(
      expect.objectContaining({ shouldRefresh: true, reason: "revived_stale", stale: true }),
    );
  });

  it("refreshes when segment growth crosses the threshold", () => {
    const segment = {
      id: "seg-2",
      conversation_id: "conv-1",
      user_id: "user-1",
      status: "active" as const,
      title: "Travel",
      summary: "Travel summary",
      summary_embedding: null,
      topic_key: "travel",
      opened_at: "2026-04-08T00:00:00Z",
      closed_at: null,
      last_active_at: "2026-04-09T11:00:00Z",
      message_count: 42,
      metadata: {
        summary_refreshed_at: "2026-04-09T10:00:00Z",
        summary_message_count: 10,
        summary_last_message_at: "2026-04-09T10:00:00Z",
      },
    };

    expect(
      shouldRefreshSegmentSummary(segment, {
        now: Date.parse("2026-04-09T12:00:00Z"),
        reason: "grown",
      }),
    ).toEqual(expect.objectContaining({ shouldRefresh: true, reason: "grown", newMessageCount: 32 }));
  });
});

describe("refreshSegmentSummary", () => {
  it("summarizes only new segment messages and persists embedding metadata", async () => {
    vi.mocked(callLLM).mockResolvedValue({ content: "Updated segment summary" } as never);
    vi.mocked(generateEmbedding).mockResolvedValue([0.11, 0.22, 0.33]);

    const segmentRow = {
      id: "seg-3",
      conversation_id: "conv-1",
      user_id: "user-1",
      status: "active" as const,
      title: "Planning",
      summary: "Existing summary",
      summary_embedding: null,
      topic_key: "planning",
      opened_at: "2026-04-08T00:00:00Z",
      closed_at: null,
      last_active_at: "2026-04-09T11:00:00Z",
      message_count: 40,
      metadata: {
        summary_refreshed_at: "2026-04-09T10:00:00Z",
        summary_message_count: 2,
        summary_last_message_at: "2026-04-09T10:30:00Z",
      },
    };

    const messageRows = [
      {
        role: "user" as const,
        content: "Old planning note",
        created_at: "2026-04-09T10:15:00Z",
        segment_id: "seg-3",
      },
      {
        role: "assistant" as const,
        content: "Old planning answer",
        created_at: "2026-04-09T10:20:00Z",
        segment_id: "seg-3",
      },
      {
        role: "user" as const,
        content: "New planning note",
        created_at: "2026-04-09T11:10:00Z",
        segment_id: "seg-3",
      },
      {
        role: "assistant" as const,
        content: "New planning answer",
        created_at: "2026-04-09T11:15:00Z",
        segment_id: "seg-3",
      },
    ];

    const updates: Array<Record<string, unknown>> = [];

    const supabase = createSupabaseStub({
      segmentRow,
      messageRows,
      updates,
    });

    const result = await refreshSegmentSummary({
      supabase: supabase as never,
      provider: { provider: "openrouter", model: "test", apiKey: "key", config: {} } as never,
      segment: segmentRow,
      reason: "grown",
    });

    expect(result).toEqual(
      expect.objectContaining({
        refreshed: true,
        summary: "Updated segment summary",
        embedding: [0.11, 0.22, 0.33],
        reason: "grown",
        messageCount: 40,
      }),
    );

    expect(vi.mocked(callLLM)).toHaveBeenCalledTimes(1);
    const llmArgs = vi.mocked(callLLM).mock.calls[0]?.[0];
    const promptText = llmArgs?.messages.map((message: { content: string }) => message.content).join("\n");
    expect(promptText).toContain("Existing summary");
    expect(promptText).toContain("New planning note");
    expect(promptText).toContain("New planning answer");
    expect(promptText).not.toContain("Old planning note");

    expect(vi.mocked(generateEmbedding)).toHaveBeenCalledWith("Updated segment summary");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      summary: "Updated segment summary",
      summary_embedding: JSON.stringify([0.11, 0.22, 0.33]),
    });
    expect(typeof updates[0]?.metadata).toBe("object");
  });

  it("falls back to a local summary when LLM summarization fails", async () => {
    vi.mocked(callLLM).mockRejectedValue(new Error("llm unavailable"));
    vi.mocked(generateEmbedding).mockResolvedValue([0.44, 0.55]);

    const segmentRow = {
      id: "seg-4",
      conversation_id: "conv-1",
      user_id: "user-1",
      status: "closed" as const,
      title: "Research",
      summary: null,
      summary_embedding: null,
      topic_key: "research",
      opened_at: "2026-04-08T00:00:00Z",
      closed_at: "2026-04-09T11:00:00Z",
      last_active_at: "2026-04-09T11:00:00Z",
      message_count: 2,
      metadata: {},
    };

    const supabase = createSupabaseStub({
      segmentRow,
      messageRows: [
        {
          role: "user" as const,
          content: "Research the best compact cameras for travel",
          created_at: "2026-04-09T11:10:00Z",
          segment_id: "seg-4",
        },
        {
          role: "assistant" as const,
          content: "Here is a short comparison draft",
          created_at: "2026-04-09T11:12:00Z",
          segment_id: "seg-4",
        },
      ],
      updates: [],
    });

    const result = await queueSegmentSummaryRefresh({
      supabase: supabase as never,
      provider: { provider: "openrouter", model: "test", apiKey: "key", config: {} } as never,
      segmentId: "seg-4",
      reason: "closed",
    });

    expect(result).toEqual(
      expect.objectContaining({
        refreshed: true,
        summary: expect.stringContaining("Research the best compact cameras for travel"),
        embedding: [0.44, 0.55],
      }),
    );
  });
});

describe("buildSegmentAwareCompactionPlan", () => {
  it("compacts only the earliest contiguous run and keeps segment boundaries intact", () => {
    const plan = buildSegmentAwareCompactionPlan(
      [
        {
          id: "1",
          role: "user" as const,
          content: "Legacy intro",
          metadata: null,
          created_at: "2026-04-09T10:00:00Z",
          segment_id: null,
        },
        {
          id: "2",
          role: "assistant" as const,
          content: "Legacy follow-up",
          metadata: null,
          created_at: "2026-04-09T10:01:00Z",
          segment_id: null,
        },
        {
          id: "3",
          role: "user" as const,
          content: "Segment one question",
          metadata: null,
          created_at: "2026-04-09T10:02:00Z",
          segment_id: "seg-a",
        },
        {
          id: "4",
          role: "assistant" as const,
          content: "Segment one answer",
          metadata: null,
          created_at: "2026-04-09T10:03:00Z",
          segment_id: "seg-a",
        },
        {
          id: "5",
          role: "user" as const,
          content: "Segment two question",
          metadata: null,
          created_at: "2026-04-09T10:04:00Z",
          segment_id: "seg-b",
        },
        {
          id: "6",
          role: "assistant" as const,
          content: "Segment two answer",
          metadata: null,
          created_at: "2026-04-09T10:05:00Z",
          segment_id: "seg-b",
        },
      ],
      2,
    );

    expect(plan).toEqual(
      expect.objectContaining({
        shouldCompact: true,
        reason: "legacy_history",
        segmentId: null,
        lastMessageAt: "2026-04-09T10:01:00Z",
      }),
    );
    expect(plan.sourceMessages.map((message) => message.id)).toEqual(["1", "2"]);
    expect(plan.transcript).toContain("Legacy intro");
    expect(plan.transcript).not.toContain("Segment one question");
  });

  it("does not cross into the next segment when the first run is below threshold", () => {
    const plan = buildSegmentAwareCompactionPlan(
      [
        {
          id: "1",
          role: "user" as const,
          content: "Small legacy tail",
          metadata: null,
          created_at: "2026-04-09T10:00:00Z",
          segment_id: null,
        },
        {
          id: "2",
          role: "user" as const,
          content: "Segment one question",
          metadata: null,
          created_at: "2026-04-09T10:01:00Z",
          segment_id: "seg-a",
        },
        {
          id: "3",
          role: "assistant" as const,
          content: "Segment one answer",
          metadata: null,
          created_at: "2026-04-09T10:02:00Z",
          segment_id: "seg-a",
        },
      ],
      2,
    );

    expect(plan).toEqual(
      expect.objectContaining({
        shouldCompact: false,
        reason: "below_threshold",
        segmentId: null,
        sourceMessages: [
          expect.objectContaining({ id: "1" }),
        ],
      }),
    );
    expect(plan.transcript).toBe("");
  });
});

function createSupabaseStub(options: {
  segmentRow: Record<string, unknown>;
  messageRows: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
}) {
  const segmentQuery = createSegmentQuery(options.segmentRow, options.updates);
  const messageQuery = createMessageQuery(options.messageRows);

  return {
    from(table: string) {
      if (table === "conversation_segments") {
        return segmentQuery;
      }
      if (table === "messages") {
        return messageQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function createSegmentQuery(segmentRow: Record<string, unknown>, updates: Array<Record<string, unknown>>) {
  let lastUpdate: Record<string, unknown> | null = null;

  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async single() {
      return { data: segmentRow, error: null };
    },
    update(payload: Record<string, unknown>) {
      lastUpdate = payload;
      updates.push(payload);
      return {
        async eq() {
          return { data: lastUpdate, error: null };
        },
      };
    },
  };
}

function createMessageQuery(messageRows: Array<Record<string, unknown>>) {
  const state = {
    segmentId: null as string | null,
    after: null as string | null,
    limit: null as number | null,
  };

  return {
    select() {
      return this;
    },
    eq(column: string, value: string) {
      if (column === "segment_id") {
        state.segmentId = value;
      }
      return this;
    },
    gt(column: string, value: string) {
      if (column === "created_at") {
        state.after = value;
      }
      return this;
    },
    order() {
      return this;
    },
    limit(value: number) {
      state.limit = value;
      return this;
    },
    then(resolve: (value: { data: Array<Record<string, unknown>> }) => unknown) {
      let rows = messageRows.filter((row) => {
        if (state.segmentId && row.segment_id !== state.segmentId) {
          return false;
        }
        if (state.after && typeof row.created_at === "string" && row.created_at <= state.after) {
          return false;
        }
        return true;
      });

      if (typeof state.limit === "number") {
        rows = rows.slice(0, state.limit);
      }

      return Promise.resolve(resolve({ data: rows }));
    },
  };
}
