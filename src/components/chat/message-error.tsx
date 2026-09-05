"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { describeChatError } from "@/lib/chat/user-facing-error";

export function MessageError({ details, busy, onRetry, onDelete }: {
  details: string; busy?: boolean; onRetry: () => Promise<void>; onDelete: () => void;
}) {
  const error = describeChatError(details);
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50/40 p-4 dark:border-red-900 dark:bg-red-950/20">
    <h3 className="font-medium">{error.title}</h3>
    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{error.message}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void onRetry()}>Try again</Button>
      {error.settings && <Link href="/settings?tab=status" className="rounded-md px-3 py-2 text-sm text-teal-700 underline dark:text-teal-300">Check service status</Link>}
      <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete}>Delete message</Button>
    </div>
    <details className="mt-3 text-xs text-zinc-500"><summary className="cursor-pointer">Technical details</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{details}</pre></details>
  </div>;
}
