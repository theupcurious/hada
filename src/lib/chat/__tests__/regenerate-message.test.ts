import { describe, expect, it } from "vitest";
import { resolveRegenerationPair } from "@/lib/chat/regenerate-message";

describe("resolveRegenerationPair", () => {
  it("finds the target assistant message and preceding user message", () => {
    const pair = resolveRegenerationPair(
      [
        { id: "u1", role: "user", content: "first" },
        { id: "a1", role: "assistant", content: "answer one" },
        { id: "u2", role: "user", content: "second" },
        { id: "a2", role: "assistant", content: "answer two" },
      ],
      "a2",
    );

    expect(pair).toEqual({
      assistantMessageId: "a2",
      userMessageId: "u2",
      message: "second",
    });
  });

  it("finds the first user message when assistant is the second message", () => {
    const pair = resolveRegenerationPair(
      [
        { id: "u1", role: "user", content: "hello" },
        { id: "a1", role: "assistant", content: "hi there" },
      ],
      "a1",
    );

    expect(pair).toEqual({
      assistantMessageId: "a1",
      userMessageId: "u1",
      message: "hello",
    });
  });

  it("skips system messages when searching for the user message", () => {
    const pair = resolveRegenerationPair(
      [
        { id: "u1", role: "user", content: "question" },
        { id: "s1", role: "system", content: "thinking..." },
        { id: "a1", role: "assistant", content: "answer" },
      ],
      "a1",
    );

    expect(pair).toEqual({
      assistantMessageId: "a1",
      userMessageId: "u1",
      message: "question",
    });
  });

  it("throws when assistant message id is not found", () => {
    expect(() =>
      resolveRegenerationPair(
        [
          { id: "u1", role: "user", content: "hello" },
          { id: "a1", role: "assistant", content: "hi" },
        ],
        "nonexistent",
      ),
    ).toThrow("Assistant message not found for regeneration.");
  });

  it("throws when no preceding user message exists", () => {
    expect(() =>
      resolveRegenerationPair(
        [{ id: "a1", role: "assistant", content: "orphan" }],
        "a1",
      ),
    ).toThrow("No matching user message found for regeneration.");
  });

  it("throws when the id matches a user message, not an assistant", () => {
    expect(() =>
      resolveRegenerationPair(
        [
          { id: "u1", role: "user", content: "hello" },
          { id: "a1", role: "assistant", content: "hi" },
        ],
        "u1",
      ),
    ).toThrow("Assistant message not found for regeneration.");
  });
});
