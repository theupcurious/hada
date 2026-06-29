import { describe, expect, it } from "vitest";
import { extractCardsFromToolResults } from "@/lib/chat/card-extraction";

describe("extractCardsFromToolResults — integration errors", () => {
  it("emits a reconnect card when a Google tool reports not connected", () => {
    const cards = extractCardsFromToolResults([
      {
        name: "gmail_search",
        result: JSON.stringify({ success: false, error: "Google account not connected or token expired." }),
      },
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      type: "integration_error",
      data: { provider: "google", actionHref: "/settings?tab=integrations" },
    });
  });

  it("emits only one reconnect card even if several Google tools fail", () => {
    const cards = extractCardsFromToolResults([
      { name: "gmail_search", result: JSON.stringify({ success: false, error: "Google account not connected." }) },
      { name: "drive_search", result: JSON.stringify({ success: false, error: "Google account not connected." }) },
      { name: "list_calendar_events", result: JSON.stringify({ success: false, error: "Google account not connected or token expired." }) },
    ]);

    expect(cards.filter((card) => card.type === "integration_error")).toHaveLength(1);
  });

  it("does not emit a reconnect card for unrelated tool failures", () => {
    const cards = extractCardsFromToolResults([
      { name: "web_search", result: JSON.stringify({ success: false, error: "Search provider timed out." }) },
      { name: "gmail_search", result: JSON.stringify({ success: true, messages: [] }) },
    ]);

    expect(cards.filter((card) => card.type === "integration_error")).toHaveLength(0);
  });
});
