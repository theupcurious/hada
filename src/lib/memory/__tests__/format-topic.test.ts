import { describe, expect, it } from "vitest";
import { formatTopicTitle } from "@/lib/memory/format-topic";

describe("formatTopicTitle", () => {
  it("humanizes kebab-case keys", () => {
    expect(formatTopicTitle("work-hours")).toBe("Work Hours");
  });

  it("humanizes snake_case keys", () => {
    expect(formatTopicTitle("travel_preferences")).toBe("Travel Preferences");
  });

  it("collapses mixed separators and whitespace", () => {
    expect(formatTopicTitle("  diet--notes__v2 ")).toBe("Diet Notes V2");
  });

  it("leaves an already-friendly title readable", () => {
    expect(formatTopicTitle("Morning routine")).toBe("Morning Routine");
  });

  it("falls back to the raw value when there is nothing to format", () => {
    expect(formatTopicTitle("---")).toBe("---");
    expect(formatTopicTitle("")).toBe("");
  });

  it("leaves non-Latin topics intact (no dropped characters)", () => {
    // toUpperCase is a no-op for these scripts; the separator/whitespace
    // handling must still pass the content through unmangled.
    expect(formatTopicTitle("식단-선호")).toBe("식단 선호");
    expect(formatTopicTitle("勤務時間")).toBe("勤務時間");
  });
});
