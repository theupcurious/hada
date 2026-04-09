import { describe, expect, it } from "vitest";
import {
  assembleRankedContext,
  estimateTokens,
  mergeRecentConversationWindow,
  memorySourceForKind,
  type ContextRetrievalCandidate,
} from "@/lib/chat/context-retrieval";

function makeText(tokens: number): string {
  return "x".repeat(tokens * 4);
}

function candidate(
  overrides: Partial<ContextRetrievalCandidate> & Pick<ContextRetrievalCandidate, "id" | "source" | "content">,
): ContextRetrievalCandidate {
  return {
    id: overrides.id,
    source: overrides.source,
    content: overrides.content,
    role: overrides.role,
    title: overrides.title ?? null,
    topicKey: overrides.topicKey ?? null,
    kind: overrides.kind,
    pinned: overrides.pinned,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
    lastActiveAt: overrides.lastActiveAt,
    messageCount: overrides.messageCount,
    segmentId: overrides.segmentId,
    embedding: overrides.embedding,
  };
}

describe("context-retrieval", () => {
  it("keeps active segment context ahead of lower-priority sources and reserves room for profile memory", () => {
    const result = assembleRankedContext({
      userMessage: "help me continue the launch work",
      tokenBudget: 40,
      sourceBudgets: {
        active_summary: 20,
        active_recent: 20,
        profile_memory: 20,
        project_memory: 1,
        preference_memory: 1,
        older_segment_summary: 1,
        archive_memory: 1,
      },
      candidates: [
        candidate({
          id: "active-summary",
          source: "active_summary",
          title: "launch",
          content: makeText(1),
        }),
        candidate({
          id: "active-user",
          source: "active_recent",
          role: "user",
          content: makeText(1),
          createdAt: "2026-04-09T00:00:00.000Z",
        }),
        candidate({
          id: "active-assistant",
          source: "active_recent",
          role: "assistant",
          content: makeText(1),
          createdAt: "2026-04-09T00:01:00.000Z",
        }),
        candidate({
          id: "profile-memory",
          source: "profile_memory",
          kind: "profile",
          pinned: true,
          title: "timezone",
          content: makeText(1),
          updatedAt: "2026-04-08T00:00:00.000Z",
        }),
        candidate({
          id: "project-memory",
          source: "project_memory",
          kind: "project",
          title: "quarterly-plan",
          content: makeText(5),
          updatedAt: "2026-03-01T00:00:00.000Z",
        }),
        candidate({
          id: "archive-memory",
          source: "archive_memory",
          kind: "archive",
          title: "old-research",
          content: makeText(5),
          updatedAt: "2025-12-01T00:00:00.000Z",
        }),
      ],
    });

    expect(result.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "system",
    ]);
    expect(result.messages[0].content).toContain("Active segment summary");
    expect(result.messages[1].content).toBe(makeText(1));
    expect(result.messages[2].content).toBe(makeText(1));
    expect(result.messages[3].content).toContain("Pinned profile memory");
    expect(result.sourceBreakdown.active_summary.selected).toBe(1);
    expect(result.sourceBreakdown.active_recent.selected).toBe(2);
    expect(result.sourceBreakdown.profile_memory.selected).toBe(1);
    expect(result.sourceBreakdown.project_memory.selected).toBe(0);
    expect(result.sourceBreakdown.archive_memory.selected).toBe(0);
    expect(result.estimatedTokens).toBeGreaterThan(0);
    expect(result.selections.find((selection) => selection.id === "active-summary")?.reasons).toEqual(
      expect.arrayContaining(["active-segment", "source:active_summary"]),
    );
  });

  it("ranks same-source candidates by keyword overlap when embeddings are absent", () => {
    const result = assembleRankedContext({
      userMessage: "tokyo travel pass",
      tokenBudget: 80,
      candidates: [
        candidate({
          id: "relevant-project",
          source: "project_memory",
          kind: "project",
          title: "tokyo",
          topicKey: "tokyo-trip",
          content: makeText(1),
        }),
        candidate({
          id: "irrelevant-project",
          source: "project_memory",
          kind: "project",
          title: "printer",
          topicKey: "printer-maintenance",
          content: makeText(1),
        }),
      ],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain("tokyo");
    expect(result.selections.find((selection) => selection.id === "relevant-project")?.selected).toBe(true);
    expect(result.selections.find((selection) => selection.id === "irrelevant-project")?.selected).toBe(false);
  });

  it("uses cached embeddings when present to outrank keyword-mismatched candidates", () => {
    const result = assembleRankedContext({
      userMessage: "unrelated query",
      queryEmbedding: [1, 0],
      tokenBudget: 100,
      candidates: [
        candidate({
          id: "semantic-match",
          source: "archive_memory",
          kind: "archive",
          content: makeText(1),
          embedding: [1, 0],
        }),
        candidate({
          id: "semantic-miss",
          source: "archive_memory",
          kind: "archive",
          content: makeText(1),
          embedding: [0, 1],
        }),
      ],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.selections.find((selection) => selection.id === "semantic-match")?.selected).toBe(true);
    expect(result.selections.find((selection) => selection.id === "semantic-miss")?.selected).toBe(false);
    expect(result.selections.find((selection) => selection.id === "semantic-match")?.reasons).toEqual(
      expect.arrayContaining(["semantic-similarity:1.000"]),
    );
  });

  it("appends the latest live exchange from legacy context when ranked retrieval misses it", () => {
    const merged = mergeRecentConversationWindow({
      rankedMessages: [
        {
          role: "system",
          content: "Active segment summary: macro discussion",
        },
        {
          role: "user",
          content: "can we ensure the data is as of today",
        },
      ],
      legacyMessages: [
        {
          role: "user",
          content: "how should one position for the market",
        },
        {
          role: "assistant",
          content: "Wait for CPI before adding size.",
        },
        {
          role: "user",
          content: "can we ensure the data is as of today",
        },
      ],
    });

    expect(merged).toEqual([
      {
        role: "system",
        content: "Active segment summary: macro discussion",
      },
      {
        role: "user",
        content: "how should one position for the market",
      },
      {
        role: "assistant",
        content: "Wait for CPI before adding size.",
      },
      {
        role: "user",
        content: "can we ensure the data is as of today",
      },
    ]);
  });

  it("maps pinned memories to the profile bucket", () => {
    expect(memorySourceForKind("archive", true)).toBe("profile_memory");
  });

  it("keeps the token estimate consistent with the existing heuristic", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});
