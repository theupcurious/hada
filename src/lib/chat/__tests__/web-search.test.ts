import { describe, expect, it } from "vitest";
import { buildSearchContext, isFreshnessSensitiveQuery } from "@/lib/chat/tools/web-search";

describe("web-search freshness", () => {
  it("treats market and macro queries as freshness-sensitive", () => {
    expect(isFreshnessSensitiveQuery("how should one position for the market with pce today and cpi tomorrow")).toBe(true);
    expect(isFreshnessSensitiveQuery("latest BTC price and Fed reaction function")).toBe(true);
  });

  it("biases freshness-sensitive queries toward the current date", () => {
    const context = buildSearchContext(
      "how should one position for the market with pce today and cpi tomorrow",
      new Date("2026-04-09T03:00:00.000Z"),
    );

    expect(context.freshnessSensitive).toBe(true);
    expect(context.effectiveQuery).toContain("April 9, 2026");
    expect(context.effectiveQuery).toContain("latest");
  });

  it("does not duplicate the date when the query already has one", () => {
    const context = buildSearchContext(
      "cpi april 9 2026 latest release",
      new Date("2026-04-09T03:00:00.000Z"),
    );

    expect(context.effectiveQuery).toBe("cpi april 9 2026 latest release");
  });

  it("leaves evergreen queries unchanged", () => {
    const context = buildSearchContext("what is a discounted cash flow model", new Date("2026-04-09T03:00:00.000Z"));

    expect(context.freshnessSensitive).toBe(false);
    expect(context.effectiveQuery).toBe("what is a discounted cash flow model");
  });
});
