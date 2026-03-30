import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatMessageRow } from "@/components/chat/chat-message-row";

describe("ChatMessageRow", () => {
  it("renders assistant markdown as rich content while streaming", () => {
    render(
      <ChatMessageRow
        message={{
          id: "m1",
          role: "assistant",
          content: "**bold**",
          streamSegments: [{ id: "s1", text: "**bold**" }],
          isStreaming: true,
          created_at: new Date().toISOString(),
        }}
        onQuickReply={vi.fn()}
        onCopy={vi.fn(async () => undefined)}
        onRegenerate={vi.fn(async () => undefined)}
        onFeedback={vi.fn(async () => undefined)}
        onSaveToDoc={vi.fn()}
        onOpenArtifact={vi.fn()}
      />,
    );

    expect(screen.queryByText("**bold**")).not.toBeInTheDocument();
    expect(screen.getByText("bold", { selector: "strong" })).toBeInTheDocument();
  });

  it("calls delete handler from hover actions", async () => {
    const user = userEvent.setup();
    const onDeleteMessage = vi.fn(async () => undefined);

    render(
      <ChatMessageRow
        message={{
          id: "m2",
          role: "assistant",
          content: "Hello",
          isStreaming: false,
          created_at: new Date().toISOString(),
        }}
        onQuickReply={vi.fn()}
        onCopy={vi.fn(async () => undefined)}
        onRegenerate={vi.fn(async () => undefined)}
        onFeedback={vi.fn(async () => undefined)}
        onSaveToDoc={vi.fn()}
        onOpenArtifact={vi.fn()}
        onDeleteMessage={onDeleteMessage}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete message/i }));
    expect(onDeleteMessage).toHaveBeenCalledWith("m2");
  });
});
