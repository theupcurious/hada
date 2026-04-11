import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageActions } from "@/components/chat/message-actions";

describe("MessageActions", () => {
  it("shows copy, regenerate, and feedback actions", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const onRegenerate = vi.fn();
    const onFeedback = vi.fn();

    render(
      <MessageActions
        copied={false}
        feedbackValue={undefined}
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        onFeedback={onFeedback}
        onSaveToDoc={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /copy/i }));
    await user.click(screen.getByRole("button", { name: /regenerate/i }));
    await user.click(screen.getByRole("button", { name: /thumbs up/i }));

    expect(onCopy).toHaveBeenCalled();
    expect(onRegenerate).toHaveBeenCalled();
    expect(onFeedback).toHaveBeenCalledWith("up");
  });
});
