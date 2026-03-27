"use client";

import { useState } from "react";
import { ExternalLink, Globe, Search } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  favicon?: string;
  source?: string;
}

export interface SearchResultsCardProps {
  query: string;
  results: SearchResultItem[];
}

export function SearchResultsCard({ query, results }: SearchResultsCardProps) {
  if (!results.length) {
    return null;
  }

  const visibleResults = results.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="my-3 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-950/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">
            Search results{query ? ` for "${query}"` : ""}
          </span>
        </div>
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
          {visibleResults.length} result{visibleResults.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-2 p-3 sm:p-4">
        {visibleResults.map((result, index) => (
          <SearchResultRow key={`${result.url}-${index}`} result={result} />
        ))}
      </div>
    </motion.div>
  );
}

function SearchResultRow({ result }: { result: SearchResultItem }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const domain = extractDomain(result.url);
  const faviconUrl = result.favicon || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : "");
  const showFavicon = Boolean(faviconUrl) && !faviconFailed;

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "group flex gap-3 rounded-xl border border-zinc-200/60 bg-white/70 p-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800/70 dark:bg-zinc-950/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60",
      )}
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        {showFavicon ? (
          <img
            src={faviconUrl}
            alt=""
            className="h-4 w-4 rounded-sm"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <Globe className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 transition-colors group-hover:text-teal-600 dark:text-zinc-100 dark:group-hover:text-teal-400">
              {result.title || "Untitled result"}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500">
              {result.source || domain || result.url}
            </p>
          </div>
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {result.snippet || result.url}
        </p>
      </div>
    </a>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
