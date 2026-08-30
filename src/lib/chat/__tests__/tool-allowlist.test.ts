import { describe, expect, it } from "vitest";
import { registry, ALWAYS_ON_TOOL_NAMES } from "@/lib/chat/tools/tool-registry";
import "@/lib/chat/tools"; // register all core tools as a side effect
import type { ToolContext } from "@/lib/chat/tools/types";

// A minimal context is enough — the tools are only instantiated, not executed.
const ctx = { userId: "u1", source: "web" } as unknown as ToolContext;

const names = (tools: { name: string }[]) => new Set(tools.map((t) => t.name));

describe("per-space tool allowlist (getAvailable)", () => {
  it("null allowlist is unrestricted — same set as no allowlist arg", () => {
    const unrestricted = names(registry.getAvailable(ctx, []));
    const withNull = names(registry.getAvailable(ctx, [], null));
    expect(withNull).toEqual(unrestricted);
    // sanity: a gateable tool is present when unrestricted
    expect(unrestricted.has("web_search")).toBe(true);
  });

  it("an array offers exactly those gateable tools plus every always-on core tool", () => {
    const result = names(registry.getAvailable(ctx, [], ["web_search"]));
    expect(result.has("web_search")).toBe(true);
    for (const core of ALWAYS_ON_TOOL_NAMES) {
      expect(result.has(core)).toBe(true);
    }
    // a gateable tool not in the allowlist is gone
    expect(result.has("web_fetch")).toBe(false);
  });

  it("an empty array leaves only the always-on core tools", () => {
    const result = names(registry.getAvailable(ctx, [], []));
    expect(result).toEqual(new Set(ALWAYS_ON_TOOL_NAMES));
    expect(result.has("web_search")).toBe(false);
  });

  it("integration gating still applies on top of the allowlist", () => {
    // gmail_send requires the google integration; allowlisting it without the
    // integration connected must not surface it.
    const withoutIntegration = names(registry.getAvailable(ctx, [], ["gmail_send"]));
    expect(withoutIntegration.has("gmail_send")).toBe(false);

    const withIntegration = names(registry.getAvailable(ctx, ["google"], ["gmail_send"]));
    expect(withIntegration.has("gmail_send")).toBe(true);
  });
});
