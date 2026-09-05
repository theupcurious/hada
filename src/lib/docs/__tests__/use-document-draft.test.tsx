import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentDraft } from "@/lib/docs/use-document-draft";

const initial = { title: "Draft", content: "Original", folder: "" };
describe("document recovery and save ordering", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("recovers unsaved edits after switching away and remounting", async () => {
    const save = vi.fn(async () => false);
    const first = renderHook(() => useDocumentDraft("test-doc", initial, save));
    act(() => first.result.current.update({ content: "Keep this" }));
    first.unmount();
    const second = renderHook(() => useDocumentDraft("test-doc", initial, save));
    await waitFor(() => expect(second.result.current.draft.content).toBe("Keep this"));
    expect(second.result.current.recovered).toBe(true);
    second.unmount();
  });
  it("serializes saves and retains edits typed during an in-flight request", async () => {
    let release!: (value: boolean) => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise<boolean>((resolve) => { release = resolve; })).mockResolvedValue(true);
    const { result } = renderHook(() => useDocumentDraft("test-doc", initial, save));
    act(() => result.current.update({ content: "First" }));
    let flushed!: Promise<boolean>;
    act(() => { flushed = result.current.flush(); });
    act(() => result.current.update({ content: "Second" }));
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { release(true); await flushed; });
    expect(save.mock.calls.map(([draft]) => draft.content)).toEqual(["First", "Second"]);
    expect(result.current.status).toBe("saved");
    expect(localStorage.getItem("test-doc")).toBeNull();
  });
  it("keeps a failed draft and permits an explicit retry", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true);
    const { result } = renderHook(() => useDocumentDraft("test-doc", initial, save));
    act(() => result.current.update({ title: "Unsaved title" }));
    await act(async () => { expect(await result.current.flush()).toBe(false); });
    expect(result.current.status).toBe("error");
    expect(localStorage.getItem("test-doc")).toContain("Unsaved title");
    await act(async () => { expect(await result.current.flush()).toBe(true); });
    expect(result.current.status).toBe("saved");
  });
  it("autosaves after typing settles", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => true);
    const { result } = renderHook(() => useDocumentDraft("test-doc", initial, save));
    act(() => result.current.update({ content: "Autosave me" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(901); });
    expect(save).toHaveBeenCalledWith({ ...initial, content: "Autosave me" });
    expect(result.current.status).toBe("saved");
  });
});
