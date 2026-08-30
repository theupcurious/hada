"use client";

import { FileText, X } from "lucide-react";

export interface AttachedDoc {
  id: string;
  title: string;
  content: string;
}

interface AttachedDocChipsProps {
  attachedDocs: AttachedDoc[];
  onDetach: (docId: string) => void;
}

export function AttachedDocChips({ attachedDocs, onDetach }: AttachedDocChipsProps) {
  if (attachedDocs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800/60">
      {attachedDocs.map((doc) => (
        <span
          key={doc.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-300"
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="max-w-[160px] truncate">{doc.title}</span>
          <button
            type="button"
            onClick={() => onDetach(doc.id)}
            className="ml-0.5 rounded-full text-teal-500 hover:text-teal-700 dark:hover:text-teal-200"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
