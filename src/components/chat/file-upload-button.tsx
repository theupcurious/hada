"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttachedDoc } from "@/components/chat/doc-attach-picker";

const ACCEPT =
  ".pdf,.docx,.xlsx,.xls,.csv,.tsv,.txt,.md,.markdown,.json,.log,application/pdf,text/*";

export interface FileUploadButtonProps {
  onAttach: (doc: AttachedDoc) => void;
  disabled?: boolean;
  title?: string;
}

export function FileUploadButton({ onAttach, disabled, title }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/attachments/extract", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => null)) as
          | { title?: string; content?: string; error?: string }
          | null;
        if (!response.ok || !data?.content) {
          throw new Error(data?.error || `Couldn't read ${file.name}.`);
        }
        onAttach({
          id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: data.title || file.name,
          content: data.content,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      setError(message);
      window.setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={title ?? "Attach a file"}
        title={title ?? "Attach a PDF, Word, Excel/CSV, or text file"}
        className="h-8 w-8 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>
      {error ? (
        <span className="max-w-[14rem] truncate text-xs text-red-500" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
