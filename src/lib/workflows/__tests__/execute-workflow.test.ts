import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeWorkflow, WorkflowBusyError } from "@/lib/workflows/execute-workflow";
import { processMessage } from "@/lib/chat/process-message";
import { sendTelegramToUser } from "@/lib/telegram/send";
import type { ScheduledTask } from "@/lib/types/database";
vi.mock("@/lib/chat/process-message", () => ({ processMessage: vi.fn() }));
vi.mock("@/lib/telegram/send", () => ({ sendTelegramToUser: vi.fn() }));
const task: ScheduledTask = { id: "task", user_id: "user", type: "once", project_id: "writing", description: "Draft a brief", enabled: true, run_at: null, cron_expression: null, last_run_at: null, created_at: "" };
function database(claimed = true) {
  const chain = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { name: "Writing" } })) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.update.mockReturnValue(chain);
  const db = { rpc: vi.fn(async () => ({ data: claimed })), from: vi.fn(() => chain) };
  return { db: db as unknown as SupabaseClient, chain };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(processMessage).mockResolvedValue({ response: "Done", metadata: {}, conversationId: "conversation", assistantMessageId: "result", userMessageId: "input" });
});
describe("shared workflow execution", () => {
  it.each(["manual", "cron"] as const)("preserves Space context for %s", async (trigger) => {
    const { db, chain } = database();
    const result = await executeWorkflow(db, task, trigger);
    expect(processMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: "writing", userId: "user", source: "scheduled" }));
    expect(result.resultUrl).toBe("/chat?project=writing&message=result");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ execution_token: null }));
    if (trigger === "cron") expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });
  it("does not execute when another worker has the claim", async () => {
    await expect(executeWorkflow(database(false).db, task, "manual")).rejects.toBeInstanceOf(WorkflowBusyError);
    expect(processMessage).not.toHaveBeenCalled();
  });
  it("keeps the saved result when Telegram delivery fails", async () => {
    vi.mocked(sendTelegramToUser).mockRejectedValueOnce(new Error("offline"));
    const result = await executeWorkflow(database().db, task, "manual");
    expect(result.success).toBe(true);
    expect(result.message).toContain("Telegram delivery failed");
  });
  it("releases the claim after an agent exception", async () => {
    vi.mocked(processMessage).mockRejectedValueOnce(new Error("failed"));
    const { db, chain } = database();
    await expect(executeWorkflow(db, task, "manual")).rejects.toThrow("failed");
    expect(chain.update).toHaveBeenCalledWith({ execution_token: null, execution_started_at: null });
  });
});
