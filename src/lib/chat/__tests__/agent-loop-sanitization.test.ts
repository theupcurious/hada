import { describe, expect, it } from "vitest";
import { sanitizeAssistantContent } from "@/lib/chat/agent-loop";

describe("sanitizeAssistantContent", () => {
  it("removes closed <think> and <thought> blocks", () => {
    expect(sanitizeAssistantContent("<think>internal</think>Visible answer")).toBe("Visible answer");
    expect(sanitizeAssistantContent("<thought>plan</thought>Visible answer")).toBe("Visible answer");
  });

  it("removes unterminated reasoning tags", () => {
    expect(sanitizeAssistantContent("<think>internal only")).toBe("");
    expect(sanitizeAssistantContent("<thought>internal only")).toBe("");
  });

  it("preserves normal user-facing text", () => {
    expect(sanitizeAssistantContent("Final answer only.")).toBe("Final answer only.");
  });
});
