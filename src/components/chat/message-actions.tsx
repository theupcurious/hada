"use client";

import { Bookmark, Check, Copy, ExternalLink, RefreshCcw, Trash2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MessageActions(props: {
  copied: boolean;
  feedbackValue?: "up" | "down";
  isLong?: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onFeedback: (value: "up" | "down") => void;
  onSaveToDoc: () => void;
  onOpenArtifact?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="pointer-events-auto inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Copy"
        data-active={props.copied}
        onClick={props.onCopy}
      >
        {props.copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Save to Docs"
        onClick={props.onSaveToDoc}
        title="Save to Docs"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </Button>
      {props.isLong && props.onOpenArtifact && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Ingest to wiki"
          onClick={props.onOpenArtifact}
          title="Ingest to wiki"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Regenerate"
        onClick={props.onRegenerate}
      >
        <RefreshCcw className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Thumbs up"
        data-active={props.feedbackValue === "up"}
        onClick={() => props.onFeedback("up")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Thumbs down"
        data-active={props.feedbackValue === "down"}
        onClick={() => props.onFeedback("down")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Delete message"
        onClick={props.onDelete}
        className="text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
