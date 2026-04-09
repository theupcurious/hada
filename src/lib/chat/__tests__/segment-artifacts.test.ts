import { describe, expect, it, vi } from "vitest";
import {
  buildSegmentArtifactContextMessages,
  buildSegmentArtifactSummary,
  classifySegmentArtifactKind,
  deriveSegmentArtifactTitle,
  persistSegmentArtifact,
  rankSegmentArtifacts,
  shouldPersistSegmentArtifact,
  type SegmentArtifactRecord,
} from "@/lib/chat/segment-artifacts";

describe("segment artifacts", () => {
  it("detects long-job outputs only when the turn is both long-job shaped and long enough", () => {
    expect(
      shouldPersistSegmentArtifact({
        triggeringMessage: "Write me a memo on the new market entry strategy.",
        assistantResponse: "short answer",
      }),
    ).toBe(false);

    expect(
      shouldPersistSegmentArtifact({
        triggeringMessage: "Write me a memo on the new market entry strategy.",
        assistantResponse: "x".repeat(2_000),
      }),
    ).toBe(true);

    expect(
      shouldPersistSegmentArtifact({
        triggeringMessage: "How are you today?",
        assistantResponse: "x".repeat(2_500),
      }),
    ).toBe(false);
  });

  it("derives a concise summary and title without replaying the whole transcript", () => {
    const response = [
      "# Market Entry Analysis",
      "",
      "The strongest option is Singapore because it reduces regulatory risk and keeps launch costs manageable.",
      "",
      "- Option A is fastest.",
      "- Option B is cheaper.",
      "",
      "```ts",
      "const plan = true;",
      "```",
    ].join("\n");

    const title = deriveSegmentArtifactTitle({
      triggeringMessage: "Please analyze the launch options.",
      assistantResponse: response,
      kind: "analysis",
    });

    const summary = buildSegmentArtifactSummary({
      title,
      assistantResponse: response,
      kind: "analysis",
    });

    expect(title).toBe("Market Entry Analysis");
    expect(summary).toContain("Market Entry Analysis");
    expect(summary).toContain("Singapore");
    expect(summary).toContain("Includes code or structured output.");
    expect(summary.length).toBeLessThanOrEqual(520);
  });

  it("classifies artifact kind from the request and response", () => {
    expect(
      classifySegmentArtifactKind({
        triggeringMessage: "Please summarize the findings.",
        assistantResponse: "Here is a summary of the results.",
      }),
    ).toBe("summary");

    expect(
      classifySegmentArtifactKind({
        triggeringMessage: "Compare the vendors and analyze tradeoffs.",
        assistantResponse: "Here is a comparison.",
      }),
    ).toBe("analysis");

    expect(
      classifySegmentArtifactKind({
        triggeringMessage: "Write a plan for the rollout.",
        assistantResponse: "Here is a rollout plan.",
      }),
    ).toBe("memo");
  });

  it("persists normalized artifact fields and keeps the full content separate from the retrieval summary", async () => {
    const insertMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "artifact-1",
        segment_id: "segment-1",
        conversation_id: "conversation-1",
        user_id: "user-1",
        source_message_id: "message-1",
        assistant_message_id: "message-2",
        kind: "analysis",
        title: "Market Entry Analysis",
        summary: "Market Entry Analysis Singapore is the strongest option.",
        content: "full transcript",
        summary_embedding: null,
        metadata: { trigger: "Write me a memo" },
        created_at: "2026-04-09T00:00:00.000Z",
        updated_at: "2026-04-09T00:00:00.000Z",
      } satisfies SegmentArtifactRecord,
      error: null,
    });

    const supabase = {
      from: vi.fn(() => ({
        insert: insertMock,
        select: selectMock.mockImplementation(() => ({
          single: singleMock,
        })),
      })),
    } as never;

    const longResponse = [
      "Market Entry Analysis",
      "",
      "Singapore is the strongest option because it reduces regulatory risk and keeps launch costs manageable.",
      "It also gives us access to regional partners, a clearer operating baseline, and a good test market.",
      "",
      "Additional considerations:",
      "- Option A is fastest but more expensive.",
      "- Option B is cheaper but adds more delivery risk.",
      "- Option C has a weaker partner network.",
      "",
      "Recommendation: choose Singapore, then validate pricing and onboarding flow before launch.",
      "",
      "Context:",
      "The analysis covers product positioning, go-to-market sequencing, compliance work, and the likely support burden.",
      "We should keep the launch scope small and reuse the existing messaging framework where possible.",
      "",
      "Appendix:",
      "This line is repeated to make the response long enough for the persistence threshold. ".repeat(18),
    ].join("\n");

    const artifact = await persistSegmentArtifact(supabase, {
      userId: "user-1",
      conversationId: "conversation-1",
      segmentId: "segment-1",
      sourceMessageId: "message-1",
      assistantMessageId: "message-2",
      triggeringMessage: "Write me a memo on the launch strategy.",
      assistantResponse: longResponse,
    });

    expect(artifact?.id).toBe("artifact-1");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        segment_id: "segment-1",
        conversation_id: "conversation-1",
        user_id: "user-1",
        source_message_id: "message-1",
        assistant_message_id: "message-2",
        kind: "analysis",
        title: "Market Entry Analysis",
        summary: expect.stringContaining("Singapore"),
        content: expect.stringContaining("Singapore is the strongest option"),
      }),
    );
  });

  it("ranks active-segment artifacts first and formats only summaries for context", () => {
    const artifacts: SegmentArtifactRecord[] = [
      {
        id: "artifact-1",
        segment_id: "segment-active",
        conversation_id: "conversation-1",
        user_id: "user-1",
        source_message_id: null,
        assistant_message_id: null,
        kind: "analysis",
        title: "Tokyo Flights",
        summary: "Flight options to Tokyo, with the best route via Singapore.",
        content: "full transcript A",
        summary_embedding: null,
        metadata: {},
        created_at: "2026-04-09T00:00:00.000Z",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
      {
        id: "artifact-2",
        segment_id: "segment-old",
        conversation_id: "conversation-1",
        user_id: "user-1",
        source_message_id: null,
        assistant_message_id: null,
        kind: "summary",
        title: "Budget Review",
        summary: "Annual budget review and tradeoffs.",
        content: "full transcript B",
        summary_embedding: null,
        metadata: {},
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ];

    const ranked = rankSegmentArtifacts(artifacts, {
      userMessage: "What were the Tokyo flight options again?",
      activeSegmentId: "segment-active",
      candidateSegmentIds: ["segment-old"],
      maxArtifacts: 2,
    });

    expect(ranked[0]?.id).toBe("artifact-1");
    expect(ranked[0]?.scoreReasons).toContain("active-segment");

    const messages = buildSegmentArtifactContextMessages(artifacts, {
      userMessage: "What were the Tokyo flight options again?",
      activeSegmentId: "segment-active",
      candidateSegmentIds: ["segment-old"],
      maxArtifacts: 2,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toContain("Relevant segment artifacts:");
    expect(messages[0]?.content).toContain("Flight options to Tokyo");
    expect(messages[0]?.content).toContain("summary=");
    expect(messages[0]?.content).not.toContain("full transcript");
  });
});
