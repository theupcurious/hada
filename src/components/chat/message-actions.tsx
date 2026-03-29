"use client";

import { Bookmark, Check, Copy, ExternalLink, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
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
}) {
  return (
    <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white/95 p-1 shadow-lg shadow-black/5 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Copy"
        data-active={props.copied}
        onClick={props.onCopy}
      >
        {props.copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        size="icon-xs"
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
          size="icon-xs"
          variant="ghost"
          aria-label="Open as document"
          onClick={props.onOpenArtifact}
          title="Open as document"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Regenerate"
        onClick={props.onRegenerate}
      >
        <RefreshCcw className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Thumbs up"
        data-active={props.feedbackValue === "up"}
        onClick={() => props.onFeedback("up")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Thumbs down"
        data-active={props.feedbackValue === "down"}
        onClick={() => props.onFeedback("down")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
