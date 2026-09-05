"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionApprovalCardProps {
  functionName: string;
  args: Record<string, unknown>;
  disabled?: boolean;
  onDecision: (decision: "approve" | "reject", editedArgs?: Record<string, unknown>) => Promise<void> | void;
}

interface ActionDescriptor {
  title: string;
  verb: string;
  details: Array<{ label: string; value: string }>;
}

export function ActionApprovalCard({ functionName, args, disabled, onDecision }: ActionApprovalCardProps) {
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const isEmail = functionName === "gmail_send" || functionName === "send_email";
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Record<string, unknown>>(args);
  const [error, setError] = useState<string | null>(null);
  const descriptor = describeAction(functionName, edited);
  const bodyKey = typeof args.body === "string" ? "body" : "message";
  const busy = disabled || submitting !== null;

  const handle = async (decision: "approve" | "reject") => {
    if (busy) return;
    setError(null);
    setSubmitting(decision);
    try {
      await onDecision(decision, isEmail ? edited : undefined);
    } catch {
      setError("Couldn’t confirm this action. Check its status before trying again.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-amber-300/60 bg-amber-50/70 shadow-sm dark:border-amber-400/30 dark:bg-amber-400/5"
    >
      <div className="flex items-center gap-2 border-b border-amber-300/50 px-4 py-2.5 dark:border-amber-400/20">
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-full bg-amber-500/15 text-[11px] text-amber-700 dark:text-amber-300"
        >
          !
        </span>
        <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Approval needed
        </span>
      </div>

      <div className="space-y-3 px-4 py-3">
        <p className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">{descriptor.title}</p>

        {descriptor.details.length > 0 ? (
          <dl className="space-y-1.5 rounded-xl border border-amber-200/60 bg-white/60 px-3 py-2.5 text-sm dark:border-amber-400/15 dark:bg-zinc-950/40">
            {descriptor.details.map((detail) => (
              <div key={detail.label} className="flex gap-3">
                <dt className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {detail.label}
                </dt>
                <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200 [overflow-wrap:anywhere]">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {isEmail && editing && <div className="space-y-3">
          {["to", "subject", bodyKey, ...["cc", "bcc"].filter((key) => key in args)].map((key) => <label key={key} className="block text-sm">
            <span className="mb-1 block font-medium">{key === bodyKey ? "Body" : key === "to" ? "To" : key === "subject" ? "Subject" : key.toUpperCase()}</span>
            <textarea value={String(edited[key] ?? "")} rows={key === bodyKey ? 8 : 1} disabled={busy}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950"
              onChange={(event) => setEdited((prev) => ({ ...prev, [key]: event.target.value }))} />
          </label>)}
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Review changes</Button>
        </div>}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-0.5">
          {isEmail && !editing && <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>Edit email</Button>}
          <Button
            type="button"
            size="sm"
            variant="brand"
            className="rounded-full"
            onClick={() => handle("approve")}
            disabled={busy || editing || (isEmail && !String(edited.to ?? "").trim())}
          >
            {submitting === "approve" ? "Working…" : `Approve · ${descriptor.verb}`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("rounded-full", busy && "opacity-70")}
            onClick={() => handle("reject")}
            disabled={busy}
          >
            {submitting === "reject" ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function describeAction(functionName: string, args: Record<string, unknown>): ActionDescriptor {
  const str = (key: string): string => {
    const value = args[key];
    return typeof value === "string" ? value : value == null ? "" : String(value);
  };

  switch (functionName) {
    case "gmail_send":
    case "send_email":
      return {
        title: "Send this email?",
        verb: "Send",
        details: compact([
          ["To", str("to")],
          ["Subject", str("subject")],
          ["Cc", str("cc")],
          ["Bcc", str("bcc")],
          ["Body", str("body") || str("message")],
        ]),
      };
    case "delete_calendar_event":
      return {
        title: "Delete this calendar event?",
        verb: "Delete",
        details: compact([
          ["Event", str("summary") || str("eventId") || str("event_id")],
          ["When", str("start")],
        ]),
      };
    case "create_calendar_event":
      return {
        title: "Add this event to your calendar?",
        verb: "Add",
        details: compact([
          ["Event", str("summary") || str("title")],
          ["Start", str("start")],
          ["End", str("end")],
        ]),
      };
    case "update_calendar_event":
      return {
        title: "Update this calendar event?",
        verb: "Update",
        details: compact([
          ["Event", str("summary") || str("eventId") || str("event_id")],
          ["Start", str("start")],
          ["End", str("end")],
        ]),
      };
    case "delete_document":
      return {
        title: "Delete this document?",
        verb: "Delete",
        details: compact([["Document", str("title") || str("id") || str("documentId")]]),
      };
    default:
      return {
        title: `Run "${humanize(functionName)}"?`,
        verb: "Run",
        details: compact(
          Object.entries(args)
            .slice(0, 5)
            .map(([key, value]) => [humanize(key), truncate(stringifyValue(value), 200)] as [string, string]),
        ),
      };
  }
}

function compact(entries: Array<[string, string]>): Array<{ label: string; value: string }> {
  return entries
    .filter(([, value]) => value.trim().length > 0)
    .map(([label, value]) => ({ label, value }));
}

function humanize(text: string): string {
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
