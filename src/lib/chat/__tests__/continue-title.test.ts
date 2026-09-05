import { describe, expect, it } from "vitest";
import { continueTitle } from "@/lib/chat/continue-title";
describe("continuation titles", () => {
  it("skips greetings and acknowledgments in favor of actual work", () => {
    expect(continueTitle([{ role: "user", content: "Plan a week of workouts" }, { role: "assistant", content: "Plan" }, { role: "user", content: "Thanks!" }], "Continue")).toBe("Plan a week of workouts");
  });
  it("uses a useful fallback when the thread contains only a greeting", () => {
    expect(continueTitle([{ role: "user", content: "hello" }], "Pick up where you left off")).toBe("Pick up where you left off");
  });
});
