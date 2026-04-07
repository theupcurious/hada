"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Bookmark, X } from "lucide-react";
import { MermaidDiagram } from "@/components/chat/mermaid-diagram";
import { InlineChart } from "@/components/chat/inline-chart";
import { RichMessageContent } from "@/components/chat/rich-message-content";
import { SaveToDocModal } from "@/components/chat/save-to-doc-modal";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface ArtifactData {
  id?: string;
  type: "response" | "document";
  title: string;
  content?: string;
  loading?: boolean;
  visuals?: Array<{ type: "mermaid" | "chart"; code: string }>;
}

interface ArtifactPanelProps {
  artifact: ArtifactData;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const saveContent = artifact.content ?? "";
  const isDoc = artifact.type === "document";
  const showLoadingState = isDoc && artifact.loading && !artifact.content;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex h-full flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
              isDoc 
                ? "bg-teal-500/15 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400" 
                : "bg-blue-500/15 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
            }`}>
              {isDoc ? "Doc" : "Canvas"}
            </span>
            <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {artifact.title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isDoc && artifact.id ? (
              <Link href={`/docs?id=${artifact.id}`} target="_blank">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  title="Open in Docs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Full View
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                onClick={() => setShowSaveModal(true)}
                title="Save to Docs"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Save
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close artifact panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            {showLoadingState ? (
              <div className="rounded-2xl border border-dashed border-zinc-200/80 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Loading document...
              </div>
            ) : null}
            {artifact.content && (
              <RichMessageContent content={artifact.content} isStreaming={false} />
            )}
            {artifact.visuals && artifact.visuals.length > 0 && (
              <div className="mt-4 space-y-4">
                {artifact.visuals.map((visual, i) => (
                  <div key={i} className="w-full">
                    {visual.type === "mermaid" ? (
                      <MermaidDiagram chart={visual.code} />
                    ) : (
                      <InlineChart code={visual.code} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {showSaveModal && (
        <SaveToDocModal content={saveContent} onClose={() => setShowSaveModal(false)} />
      )}
    </AnimatePresence>
  );
}
