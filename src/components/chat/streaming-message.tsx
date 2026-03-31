"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface StreamingSegment {
  id: string;
  text: string;
}

export function StreamingMessage({ segments }: { segments: StreamingSegment[] }) {
  return (
    <div className="min-w-0 w-full max-w-full overflow-hidden text-base leading-relaxed [overflow-wrap:anywhere]">
      <AnimatePresence initial={false}>
        {segments.map((segment) => (
          <motion.span
            key={segment.id}
            initial={{ opacity: 0.24 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="whitespace-pre-wrap"
          >
            {segment.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
