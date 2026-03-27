"use client";

import { motion } from "framer-motion";
import { Table } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableCardProps {
  title?: string;
  headers: string[];
  rows: string[][];
}

export function DataTableCard({ title, headers, rows }: DataTableCardProps) {
  if (!headers.length || !rows.length) {
    return null;
  }

  const columnCount = Math.max(
    headers.length,
    ...rows.map((row) => row.length),
  );

  const normalizedHeaders = Array.from({ length: columnCount }, (_, index) =>
    headers[index] || `Column ${index + 1}`,
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="my-3 overflow-hidden rounded-xl border border-zinc-200/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50"
      aria-label={title || "Data table"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <Table className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title || "Table"}</span>
        </div>
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-950/40">
              {normalizedHeaders.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className={cn(
                    "whitespace-nowrap border-b border-zinc-200/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800/70 dark:text-zinc-400",
                    index === 0 && "pl-4",
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={`${rowIndex}-${row.join("|")}`}
                className={cn(
                  rowIndex % 2 === 0
                    ? "bg-white/60 dark:bg-zinc-950/20"
                    : "bg-zinc-50/40 dark:bg-zinc-900/40",
                )}
              >
                {normalizedHeaders.map((_, columnIndex) => {
                  const cell = row[columnIndex] ?? "";
                  return (
                    <td
                      key={`${rowIndex}-${columnIndex}`}
                      className={cn(
                        "max-w-[18rem] border-b border-zinc-100 px-4 py-3 align-top text-zinc-700 dark:border-zinc-800/60 dark:text-zinc-300",
                        columnIndex === 0 && "font-medium text-zinc-900 dark:text-zinc-100",
                      )}
                    >
                      <span className="block whitespace-pre-wrap break-words leading-relaxed">
                        {cell || "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}
