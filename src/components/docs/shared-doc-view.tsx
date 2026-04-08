"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FilePlus2, LogIn } from "lucide-react";
import { RichMessageContent } from "@/components/chat/rich-message-content";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface SharedDocViewProps {
  title: string;
  content: string;
  shareUrl: string;
  updatedAt: string;
}

function toDownloadFilename(title: string) {
  const sanitized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${sanitized || "hada-document"}.md`;
}

export function SharedDocView({
  title,
  content,
  shareUrl,
  updatedAt,
}: SharedDocViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const resolvedShareUrl = useMemo(() => {
    if (shareUrl.startsWith("http://") || shareUrl.startsWith("https://")) {
      return shareUrl;
    }
    if (typeof window !== "undefined") {
      return new URL(shareUrl, window.location.origin).toString();
    }
    return shareUrl;
  }, [shareUrl]);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }
      setIsSignedIn(Boolean(session));
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsSignedIn(Boolean(data.session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const updatedLabel = new Date(updatedAt).toLocaleString();

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = toDownloadFilename(title);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resolvedShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setMessage("Could not copy the link.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, folder: null }),
      });

      if (response.status === 401) {
        setMessage("Sign in to save this document to your Hada docs.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save document");
      }

      const data = (await response.json()) as { document?: { id?: string } };
      setSavedDocId(data.document?.id ?? null);
      setMessage("Saved to your Hada docs.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save document");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_30%),linear-gradient(180deg,_#fafafa,_#f4f4f5)] text-zinc-950 dark:bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16),_transparent_35%),linear-gradient(180deg,_#09090b,_#111827)] dark:text-zinc-50">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-600 dark:text-teal-400">
                Shared Hada Doc
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {title}
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Updated {updatedLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download
              </Button>
              {savedDocId ? (
                <Button asChild size="sm">
                  <Link href={`/docs?id=${savedDocId}`}>
                    <Check className="h-4 w-4" />
                    Open in Docs
                  </Link>
                </Button>
              ) : isSignedIn ? (
                <Button type="button" size="sm" onClick={() => void handleSave()} disabled={isSaving}>
                  <FilePlus2 className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save to my docs"}
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/auth/login">
                    <LogIn className="h-4 w-4" />
                    Sign in to save
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {message ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          ) : null}
        </header>

        <main className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8 dark:border-zinc-800/80 dark:bg-zinc-900/85">
          <RichMessageContent content={content} />
        </main>
      </div>
    </div>
  );
}
