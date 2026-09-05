import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TasksTab } from "@/components/settings/tasks-tab";
vi.mock("@/lib/hooks/use-resolved-locale", () => ({ useResolvedLocale: () => "en" }));
vi.mock("@/components/settings/workflow-gallery", () => ({ WorkflowGallery: () => null }));
const task = { id: "task-1", description: "Morning brief", type: "recurring", enabled: true };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());
describe("workflow controls", () => {
  it("prevents double clicks and links to a completed result", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn((_url: string, options?: RequestInit) => options?.method === "POST"
      ? new Promise<Response>((resolve) => { finish = resolve; })
      : Promise.resolve(reply({ tasks: [task] })));
    vi.stubGlobal("fetch", fetcher);
    render(<TasksTab />);
    const run = await screen.findByRole("button", { name: "Run now" });
    fireEvent.click(run); fireEvent.click(run);
    expect(run).toBeDisabled();
    expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
    finish(reply({ message: "Workflow completed.", resultUrl: "/chat?project=writing&message=result" }));
    expect(await screen.findByRole("link", { name: "Open result" })).toHaveAttribute("href", "/chat?project=writing&message=result");
    await waitFor(() => expect(run).toBeEnabled());
  });
  it("surfaces a pause failure instead of silently ignoring it", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === "PATCH"
      ? reply({ error: "Could not pause workflow" }, 500) : reply({ tasks: [task] }))));
    render(<TasksTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not pause workflow");
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  });
});
