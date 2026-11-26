import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/usage/quota", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage/quota")>();
  return {
    ...actual,
    assertWithinQuota: vi.fn(async () => {
      throw new actual.QuotaExceededError("Plan limit reached: out of messages.", "messages");
    }),
  };
});

const recordUsage = vi.fn(async () => {});
vi.mock("@/lib/usage/meter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage/meter")>();
  return { ...actual, recordUsage: (...args: unknown[]) => recordUsage(...(args as [])) };
});

describe("processMessage quota gate", () => {
  it("refuses before touching the database, recording a run, or calling a model", async () => {
    const { processMessage } = await import("@/lib/chat/process-message");
    const { QuotaExceededError } = await import("@/lib/usage/quota");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const from = vi.fn();
    const supabase = { from, rpc: vi.fn() } as unknown as SupabaseClient;

    await expect(
      processMessage({ userId: "u1", message: "hello", source: "web", supabase }),
    ).rejects.toBeInstanceOf(QuotaExceededError);

    expect(from).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
