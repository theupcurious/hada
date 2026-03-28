"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MermaidDiagram } from "@/components/chat/mermaid-diagram";
import { InlineChart } from "@/components/chat/inline-chart";
import { X } from "lucide-react";

export interface ArtifactData {
  title: string;
  visuals: Array<{ type: "mermaid" | "chart"; code: string }>;
}

interface ArtifactPanelProps {
  artifact: ArtifactData;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
              Artifact
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close artifact panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content — visuals only, no text duplication */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex h-full flex-col items-center justify-center px-6 py-6 sm:px-8 sm:py-8">
            <h2 className="mb-6 self-start text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {artifact.title}
            </h2>
            <div className="w-full space-y-4">
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
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

