import { describe, expect, it } from "vitest";
import {
  createHiddenMetadataFilter,
  extractSegmentSignal,
  sanitizeAssistantContent,
} from "@/lib/chat/agent-loop";
import {
  persistSegmentDecision,
  type ContextHint,
  type SegmentSignalData,
} from "@/lib/chat/segment-router";
import type { ConversationSegment } from "@/lib/types/database";

describe("segment metadata sanitization", () => {
  it("strips segment metadata from streamed output across chunk boundaries", () => {
    const filter = createHiddenMetadataFilter();

    const streamed = [
      filter.feed("Plan looks good.\n"),
      filter.feed("<!-- seg"),
      filter.feed("ment:new:travel-planning:Travel Planning -->"),
      filter.flush(),
    ].join("");

    expect(streamed).toBe("Plan looks good.\n");
  });

  it("extracts and removes the persisted segment signal", () => {
    expect(
      extractSegmentSignal("Done.\n<!-- segment:revive:tokyo-trip:Tokyo Trip -->"),
    ).toEqual({
      cleanedText: "Done.",
      signal: {
        signal: "revive",
        topicKey: "tokyo-trip",
        title: "Tokyo Trip",
      },
    });
  });

  it("sanitizes segment metadata from final assistant content", () => {
    expect(
      sanitizeAssistantContent("Result\n<!-- segment:continue -->"),
    ).toBe("Result");
  });
});

describe("persistSegmentDecision", () => {
  it("creates and attaches a general segment when none exists", async () => {
    const state = createSegmentState();
    const supabase = createSupabaseStub(state);

    const result = await persistSegmentDecision({
      supabase,
      conversationId: "conv-1",
      userId: "user-1",
      userMessageId: "user-msg",
      assistantMessageId: "assistant-msg",
      signal: null,
      contextHint: noActiveContextHint(),
    });

    expect(result).toEqual({
      signal: "continue",
      action: "create",
      segmentId: expect.any(String),
      closedSegmentId: null,
    });

    const [segment] = state.segments;
    expect(segment).toMatchObject({
      conversation_id: "conv-1",
      user_id: "user-1",
      status: "active",
      title: "General",
      topic_key: "general",
      message_count: 2,
    });
    expect(state.messageSegmentIds).toEqual({
      "assistant-msg": segment.id,
      "user-msg": segment.id,
    });
  });

  it("rolls back to the previous active segment when a new segment creation fails", async () => {
    const activeSegment = makeSegment({
      id: "seg-active",
      topic_key: "launch",
      title: "Launch",
      message_count: 10,
      status: "active",
      closed_at: null,
    });
    const state = createSegmentState({
      segments: [activeSegment],
      failInsertMessage: "duplicate key value violates unique constraint",
    });
    const supabase = createSupabaseStub(state);

    const result = await persistSegmentDecision({
      supabase,
      conversationId: "conv-1",
      userId: "user-1",
      userMessageId: "user-msg",
      assistantMessageId: "assistant-msg",
      signal: {
        signal: "new",
        topicKey: "travel",
        title: "Travel",
      } satisfies SegmentSignalData,
      contextHint: {
        activeSegment,
        candidateSegments: [],
        confidence: 0.2,
        reason: "forced-test",
      },
    });

    expect(result).toEqual({
      signal: "continue",
      action: "fallback",
      segmentId: "seg-active",
      closedSegmentId: null,
    });

    expect(state.segments).toHaveLength(1);
    expect(state.segments[0]).toMatchObject({
      id: "seg-active",
      status: "active",
      closed_at: null,
      message_count: 12,
    });
    expect(state.messageSegmentIds).toEqual({
      "assistant-msg": "seg-active",
      "user-msg": "seg-active",
    });
  });
});

function noActiveContextHint(): ContextHint {
  return {
    activeSegment: null,
    candidateSegments: [],
    confidence: 0,
    reason: "no_active_segment",
  };
}

function makeSegment(overrides: Partial<ConversationSegment> = {}): ConversationSegment {
  return {
    id: overrides.id ?? "seg-1",
    conversation_id: overrides.conversation_id ?? "conv-1",
    user_id: overrides.user_id ?? "user-1",
    status: overrides.status ?? "closed",
    title: overrides.title ?? "Segment",
    summary: overrides.summary ?? null,
    summary_embedding: overrides.summary_embedding ?? null,
    topic_key: overrides.topic_key ?? "segment",
    opened_at: overrides.opened_at ?? "2026-04-09T00:00:00.000Z",
    closed_at: overrides.closed_at ?? "2026-04-09T01:00:00.000Z",
    last_active_at: overrides.last_active_at ?? "2026-04-09T01:00:00.000Z",
    message_count: overrides.message_count ?? 0,
    metadata: overrides.metadata ?? {},
  };
}

function createSegmentState(options?: {
  segments?: ConversationSegment[];
  failInsertMessage?: string | null;
}) {
  return {
    segments: [...(options?.segments ?? [])],
    failInsertMessage: options?.failInsertMessage ?? null,
    messageSegmentIds: {} as Record<string, string>,
    nextSegmentId: 1,
  };
}

function createSupabaseStub(state: ReturnType<typeof createSegmentState>) {
  return {
    from(table: string) {
      if (table === "conversation_segments") {
        return createConversationSegmentsQuery(state);
      }

      if (table === "messages") {
        return createMessagesQuery(state);
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as never;
}

function createConversationSegmentsQuery(state: ReturnType<typeof createSegmentState>) {
  const filters = new Map<string, unknown>();
  let limitValue: number | null = null;
  let orderColumn: keyof ConversationSegment | null = null;
  let orderAscending = true;

  function applyFilters() {
    let rows = state.segments.filter((segment) => {
      for (const [column, value] of filters.entries()) {
        if (segment[column as keyof ConversationSegment] !== value) {
          return false;
        }
      }
      return true;
    });

    if (orderColumn) {
      rows = [...rows].sort((a, b) => {
        const key = orderColumn as keyof ConversationSegment;
        const left = String(a[key] ?? "");
        const right = String(b[key] ?? "");
        return orderAscending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }

    if (typeof limitValue === "number") {
      rows = rows.slice(0, limitValue);
    }

    return rows;
  }

  return {
    select() {
      return this;
    },
    eq(column: string, value: unknown) {
      filters.set(column, value);
      return this;
    },
    order(column: keyof ConversationSegment, options?: { ascending?: boolean }) {
      orderColumn = column;
      orderAscending = options?.ascending ?? true;
      return this;
    },
    limit(value: number) {
      limitValue = value;
      return this;
    },
    async single() {
      const rows = applyFilters();
      const data = rows[0] ?? null;
      return {
        data,
        error: data ? null : { message: "No rows" },
      };
    },
    update(payload: Partial<ConversationSegment>) {
      return {
        async eq(column: string, value: unknown) {
          for (const segment of state.segments) {
            if (segment[column as keyof ConversationSegment] === value) {
              Object.assign(segment, payload);
            }
          }
          return { data: null, error: null };
        },
      };
    },
    insert(payload: Partial<ConversationSegment>) {
      return {
        select() {
          return {
            async single() {
              if (state.failInsertMessage) {
                return { data: null, error: { message: state.failInsertMessage } };
              }

              const row = makeSegment({
                id: `seg-created-${state.nextSegmentId++}`,
                conversation_id: String(payload.conversation_id),
                user_id: String(payload.user_id),
                status: (payload.status as ConversationSegment["status"]) ?? "active",
                title: typeof payload.title === "string" ? payload.title : null,
                topic_key: typeof payload.topic_key === "string" ? payload.topic_key : null,
                opened_at: String(payload.opened_at),
                closed_at: null,
                last_active_at: String(payload.last_active_at),
                message_count: typeof payload.message_count === "number" ? payload.message_count : 0,
                metadata: (payload.metadata as Record<string, unknown> | undefined) ?? {},
              });
              state.segments.push(row);
              return { data: row, error: null };
            },
          };
        },
      };
    },
  };
}

function createMessagesQuery(state: ReturnType<typeof createSegmentState>) {
  return {
    update(payload: { segment_id?: string | null }) {
      return {
        async in(_column: string, values: string[]) {
          for (const value of values) {
            if (payload.segment_id) {
              state.messageSegmentIds[value] = payload.segment_id;
            }
          }
          return { data: null, error: null };
        },
      };
    },
  };
}
