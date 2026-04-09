"use client";

import { useEffect, useState } from "react";

interface DebugData {
  conversation: {
    id: string;
    created_at: string;
    compacted_through: string | null;
    updated_at: string;
  } | null;
  memories: Array<{
    topic: string;
    content: string;
    kind: string;
    pinned: boolean;
    updated_at: string;
  }>;
  stats: {
    totalMessages: number;
    compactionSummaries: number;
  };
  segments: Array<{
    id: string;
    status: string;
    title: string | null;
    topic_key: string | null;
    summary: string | null;
    last_active_at: string;
    message_count: number;
    metadata?: {
      summary_refreshed_at?: string;
    } | null;
  }>;
  latestRetrieval: {
    strategy?: string;
    estimatedTokens?: number;
    hint?: {
      confidence?: number;
      reason?: string;
      activeSegmentId?: string | null;
      candidateSegmentIds?: string[];
    };
    sourceBreakdown?: Record<string, { available?: number; selected?: number; tokens?: number }>;
  } | null;
}

export function DebugTab() {
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/debug/context")
      .then(async r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<DebugData>;
      })
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-8 text-sm text-zinc-400">Loading debug data…</div>;
  }

  if (error) {
    return <div className="py-8 text-sm text-red-500">Error: {error}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Debug Panel</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Admin-only view of context assembly internals.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Conversation</h3>
        {data.conversation ? (
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-zinc-400">ID</dt>
              <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{data.conversation.id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-zinc-400">Created</dt>
              <dd className="text-zinc-600 dark:text-zinc-300">{new Date(data.conversation.created_at).toLocaleString()}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-zinc-400">Compacted through</dt>
              <dd className="text-zinc-600 dark:text-zinc-300">
                {data.conversation.compacted_through
                  ? new Date(data.conversation.compacted_through).toLocaleString()
                  : "never"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-zinc-400">No conversation found.</p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Context Stats</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-36 shrink-0 text-zinc-400">Total messages</dt>
            <dd className="text-zinc-600 dark:text-zinc-300">{data.stats.totalMessages}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-36 shrink-0 text-zinc-400">Compaction summaries</dt>
            <dd className="text-zinc-600 dark:text-zinc-300">{data.stats.compactionSummaries}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Memory Entries ({data.memories.length})
        </h3>
        {data.memories.length === 0 ? (
          <p className="text-sm text-zinc-400">No memories stored.</p>
        ) : (
          <div className="space-y-2">
            {data.memories.map((m, i) => (
              <div key={i} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{m.topic}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{m.kind}</span>
                  {m.pinned && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">pinned</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{m.content}</p>
                <p className="mt-1 text-xs text-zinc-400">{new Date(m.updated_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Segments ({data.segments.length})
        </h3>
        {data.segments.length === 0 ? (
          <p className="text-sm text-zinc-400">No segments yet.</p>
        ) : (
          <div className="space-y-2">
            {data.segments.map((segment) => (
              <div key={segment.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">
                    {segment.title || segment.topic_key || "Untitled segment"}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {segment.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-mono text-zinc-400">{segment.id}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {segment.summary || "No summary yet."}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  messages={segment.message_count} last_active={new Date(segment.last_active_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Latest Retrieval</h3>
        {!data.latestRetrieval ? (
          <p className="text-sm text-zinc-400">No retrieval metadata saved yet.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="text-zinc-600 dark:text-zinc-300">
              strategy={data.latestRetrieval.strategy || "unknown"} estimatedTokens={data.latestRetrieval.estimatedTokens ?? "n/a"}
            </div>
            {data.latestRetrieval.hint ? (
              <div className="text-zinc-500 dark:text-zinc-400">
                hint confidence={data.latestRetrieval.hint.confidence ?? "n/a"} reason={data.latestRetrieval.hint.reason || "n/a"}
              </div>
            ) : null}
            {data.latestRetrieval.sourceBreakdown ? (
              <div className="space-y-1">
                {Object.entries(data.latestRetrieval.sourceBreakdown).map(([source, stats]) => (
                  <div key={source} className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="w-36 shrink-0 font-mono">{source}</span>
                    <span>available={stats.available ?? 0}</span>
                    <span>selected={stats.selected ?? 0}</span>
                    <span>tokens={stats.tokens ?? 0}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
