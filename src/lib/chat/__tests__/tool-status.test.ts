import { describe, expect, it } from "vitest";
import { buildToolStatusPills } from "@/lib/chat/tool-status";

describe("buildToolStatusPills", () => {
  it("summarizes active web search work", () => {
    const pills = buildToolStatusPills({
      isStreaming: true,
      traces: [
        { callId: "1", name: "web_search", args: {}, status: "done", durationMs: 220, result: "{}", truncated: false },
        { callId: "2", name: "web_fetch", args: {}, status: "done", durationMs: 480, result: "{}", truncated: false },
        { callId: "3", name: "web_fetch", args: {}, status: "done", durationMs: 520, result: "{}", truncated: false },
        { callId: "4", name: "web_fetch", args: {}, status: "running" },
      ],
      thinkingCount: 0,
      hasVisibleContent: false,
      backgroundJobPending: true,
    });

    expect(pills.map((pill) => pill.label)).toEqual([
      "Reading 3 sources",
      "Working in background",
    ]);
  });

  it("falls back to drafting once tools are done and text is streaming", () => {
    const pills = buildToolStatusPills({
      isStreaming: true,
      traces: [
        { callId: "1", name: "web_search", args: {}, status: "done", durationMs: 120, result: "{}", truncated: false },
      ],
      thinkingCount: 1,
      hasVisibleContent: true,
      backgroundJobPending: false,
    });

    expect(pills.at(-1)?.label).toBe("Drafting response");
  });

  it("shows analysis status after tool calls are done but text has not started", () => {
    const pills = buildToolStatusPills({
      isStreaming: true,
      traces: [
        { callId: "1", name: "web_search", args: {}, status: "done", durationMs: 120, result: "{}", truncated: false },
        { callId: "2", name: "web_fetch", args: {}, status: "done", durationMs: 240, result: "{}", truncated: false },
      ],
      thinkingCount: 0,
      hasVisibleContent: false,
      backgroundJobPending: false,
    });

    expect(pills.map((pill) => pill.label)).toEqual(["Analyzing findings"]);
  });

  it("shows document writing status while create_document is running", () => {
    const pills = buildToolStatusPills({
      isStreaming: true,
      traces: [
        { callId: "1", name: "create_document", args: { title: "Report" }, status: "running" },
      ],
      thinkingCount: 0,
      hasVisibleContent: false,
      backgroundJobPending: false,
    });

    expect(pills.map((pill) => pill.label)).toEqual(["Writing document"]);
  });

  it("shows document update status while update_document is running", () => {
    const pills = buildToolStatusPills({
      isStreaming: true,
      traces: [
        { callId: "1", name: "update_document", args: { id: "doc-1" }, status: "running" },
      ],
      thinkingCount: 0,
      hasVisibleContent: false,
      backgroundJobPending: false,
    });

    expect(pills.map((pill) => pill.label)).toEqual(["Updating document"]);
  });
});
