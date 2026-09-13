import { describe, expect, it } from "vitest";
import { checkPermission, DEFAULT_POLICY, policyForSource, UNTRUSTED_OUTPUT_TOOLS } from "@/lib/chat/tool-permissions";

describe("tool permissions", () => {
  it("defaults: low/medium allow, high confirm, gmail_draft confirm", () => {
    expect(checkPermission(DEFAULT_POLICY, "web_fetch", "low", 0)).toBe("allow");
    expect(checkPermission(DEFAULT_POLICY, "create_document", "medium", 0)).toBe("allow");
    expect(checkPermission(DEFAULT_POLICY, "gmail_send", "high", 0)).toBe("confirm");
    expect(checkPermission(DEFAULT_POLICY, "gmail_draft", "medium", 0)).toBe("confirm");
  });

  it("escalates listed tools to confirm once untrusted content has been seen", () => {
    expect(checkPermission(DEFAULT_POLICY, "schedule_task", "medium", 0)).toBe("allow");
    expect(checkPermission(DEFAULT_POLICY, "schedule_task", "medium", 0, { untrustedContentSeen: true })).toBe("confirm");
    expect(checkPermission(DEFAULT_POLICY, "create_calendar_event", "medium", 0, { untrustedContentSeen: true })).toBe("confirm");
    // Not on the list: still allowed so ordinary "fetch then summarise into a doc" flows keep working.
    expect(checkPermission(DEFAULT_POLICY, "create_document", "medium", 0, { untrustedContentSeen: true })).toBe("allow");
    expect(checkPermission(DEFAULT_POLICY, "save_memory", "medium", 0, { untrustedContentSeen: true })).toBe("allow");
  });

  it("non-web sources turn confirm into deny (no one can approve there)", () => {
    for (const source of ["telegram", "scheduled"] as const) {
      const policy = policyForSource(source);
      expect(checkPermission(policy, "gmail_send", "high", 0)).toBe("deny");
      expect(checkPermission(policy, "gmail_draft", "medium", 0)).toBe("deny");
      expect(checkPermission(policy, "schedule_task", "medium", 0, { untrustedContentSeen: true })).toBe("deny");
      expect(checkPermission(policy, "schedule_task", "medium", 0)).toBe("allow");
      expect(checkPermission(policy, "web_search", "low", 0)).toBe("allow");
    }
    expect(policyForSource("web")).toBe(DEFAULT_POLICY);
  });

  it("marks external-content tools as untrusted", () => {
    expect(UNTRUSTED_OUTPUT_TOOLS.has("web_fetch")).toBe(true);
    expect(UNTRUSTED_OUTPUT_TOOLS.has("gmail_read")).toBe(true);
    expect(UNTRUSTED_OUTPUT_TOOLS.has("save_memory")).toBe(false);
  });
});
