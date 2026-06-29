"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IntegrationErrorCardProps {
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
}

/**
 * Actionable recovery card shown when a connected-account tool fails because the
 * integration isn't available. Turns a dead-end apology into a one-click fix.
 */
export function IntegrationErrorCard({
  title,
  message,
  actionLabel,
  actionHref,
}: IntegrationErrorCardProps) {
  return (
    <div className="my-2 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{title}</p>
        <p className="mt-1 text-xs leading-5 text-amber-800/90 dark:text-amber-200/80">{message}</p>
        <Link href={actionHref} className="mt-2.5 inline-block">
          <Button size="sm" variant="outline" className="rounded-lg border-amber-400/60 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/30">
            {actionLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
