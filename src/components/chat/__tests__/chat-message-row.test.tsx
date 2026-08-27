import { render, screen } from "@testing-library/react";
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
        onDelete={vi.fn()}
        onConfirmAction={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.queryByText("**bold**")).not.toBeInTheDocument();
    expect(screen.getByText("bold", { selector: "strong" })).toBeInTheDocument();
  });

  it("shows Copy and Save when generation finishes before persistence", () => {
    render(
      <ChatMessageRow
        message={{
          id: "temp-assistant-1",
          role: "assistant",
          content: "Finished response",
          isFinalizing: true,
          created_at: new Date().toISOString(),
        }}
        onQuickReply={vi.fn()}
        onCopy={vi.fn(async () => undefined)}
        onRegenerate={vi.fn(async () => undefined)}
        onFeedback={vi.fn(async () => undefined)}
        onSaveToDoc={vi.fn()}
        onOpenArtifact={vi.fn()}
        onDelete={vi.fn()}
        onConfirmAction={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByLabelText("Copy")).toBeInTheDocument();
    expect(screen.getByLabelText("Save to Docs")).toBeInTheDocument();
    expect(screen.queryByLabelText("Regenerate")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Thumbs up")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete message")).not.toBeInTheDocument();
  });
});
