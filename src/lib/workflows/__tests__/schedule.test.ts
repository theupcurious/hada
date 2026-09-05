import { describe, expect, it } from "vitest";
import { cronRecurrenceLabel, nextRunFromCron } from "@/lib/workflows/schedule";
import { localScheduleToCron } from "@/lib/workflows/templates";

describe("nextRunFromCron", () => {
  it("finds the next matching minute for a daily cron", () => {
    const from = new Date("2026-09-05T00:00:00Z");
    const next = nextRunFromCron("30 9 * * *", from);
    expect(next?.toISOString()).toBe("2026-09-05T09:30:00.000Z");
  });

  it("rolls to the next day when today's time has passed", () => {
    const from = new Date("2026-09-05T10:00:00Z");
    const next = nextRunFromCron("0 9 * * *", from);
    expect(next?.toISOString()).toBe("2026-09-06T09:00:00.000Z");
  });

  it("returns null for a malformed expression", () => {
    expect(nextRunFromCron("not a cron")).toBeNull();
  });
});

describe("cronRecurrenceLabel", () => {
  it("labels a plain daily cron in UTC", () => {
    expect(cronRecurrenceLabel("0 9 * * *", "UTC")).toBe("Every day");
  });

  it("labels a weekday cron", () => {
    expect(cronRecurrenceLabel("0 9 * * 1,2,3,4,5", "UTC")).toBe("Weekdays (Mon–Fri)");
  });

  it("labels a single weekday", () => {
    expect(cronRecurrenceLabel("0 9 * * 1", "UTC")).toBe("Every Monday");
  });

  it("summarizes a round-tripped weekday schedule regardless of stored UTC shift", () => {
    // A New York morning schedule stored as UTC still reads as weekdays locally.
    const cron = localScheduleToCron("weekdays", "08:00", 240); // UTC = local + 4h
    expect(cronRecurrenceLabel(cron, "America/New_York")).toBe("Weekdays (Mon–Fri)");
  });

  it("returns null for a cron it cannot confidently summarize", () => {
    expect(cronRecurrenceLabel("*/15 * * * *", "UTC")).toBeNull();
  });
});
