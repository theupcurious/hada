import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionApprovalCard } from "@/components/chat/action-approval-card";

describe("email approval", () => {
  it("shows the full body and submits reviewed edits", async () => {
    const body = "a".repeat(500) + " Important final paragraph.";
    const onDecision = vi.fn(async () => {});
    render(<ActionApprovalCard functionName="gmail_send" args={{ to: "test@example.com", subject: "Draft", body }} onDecision={onDecision} />);
    await waitFor(() => expect(screen.getByText(body)).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Edit email" }));
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Revised body" } });
    expect(screen.getByRole("button", { name: "Approve · Send" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve · Send" }));
    await waitFor(() => expect(onDecision).toHaveBeenCalledWith("approve", { to: "test@example.com", subject: "Draft", body: "Revised body" }));
  });
  it("keeps the proposal available and shows an error after a failed submission", async () => {
    render(<ActionApprovalCard functionName="gmail_send" args={{ to: "test@example.com", subject: "Draft", body: "Body" }} onDecision={vi.fn(async () => { throw new Error("offline"); })} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve · Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t confirm");
    expect(screen.getByRole("button", { name: "Approve · Send" })).toBeEnabled();
  });
});
