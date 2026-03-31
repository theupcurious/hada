import { describe, expect, it } from "vitest";
import { isDeferredToolIntentResponse } from "@/lib/chat/agent-loop";

describe("isDeferredToolIntentResponse", () => {
  it("detects explicit first-person deferred tool intent", () => {
    expect(isDeferredToolIntentResponse("Let me search for the latest updates.")).toBe(true);
    expect(isDeferredToolIntentResponse("I'll check that now.")).toBe(true);
    expect(isDeferredToolIntentResponse("I am going to look up the current status.")).toBe(true);
  });

  it("does not flag follow-up prompts that ask whether to continue", () => {
    expect(
      isDeferredToolIntentResponse("Want me to dig deeper into any of these scenarios?"),
    ).toBe(false);
  });

  it("does not flag generic instructional phrasing", () => {
    expect(isDeferredToolIntentResponse("You can search for this in the docs.")).toBe(false);
    expect(isDeferredToolIntentResponse("If needed, we can dig deeper next.")).toBe(false);
  });
});
