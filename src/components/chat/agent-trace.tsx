"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Search,
  Brain,
  Clock,
  CalendarDays,
  Bookmark,
  BookOpen,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

export interface TraceEvent {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  durationMs?: number;
  truncated?: boolean;
  agentName?: string;
  order?: number;
  status: "running" | "done" | "error";
}

export interface ThinkingEvent {
  content: string;
  agentName?: string;
  order?: number;
}

const TOOL_META: Record<string, { icon: typeof Search; label: string; color: string }> = {
  web_search: { icon: Search, label: "Web Search", color: "text-blue-500" },
  web_fetch: { icon: Globe, label: "Web Fetch", color: "text-cyan-500" },
  save_memory: { icon: Bookmark, label: "Save Memory", color: "text-violet-500" },
  recall_memory: { icon: BookOpen, label: "Recall Memory", color: "text-violet-400" },
  schedule_task: { icon: Clock, label: "Schedule Task", color: "text-amber-500" },
  google_calendar_list: { icon: CalendarDays, label: "Calendar List", color: "text-green-500" },
  google_calendar_get: { icon: CalendarDays, label: "Calendar Get", color: "text-green-500" },
  google_calendar_create: { icon: CalendarDays, label: "Calendar Create", color: "text-green-500" },
  google_calendar_update: { icon: CalendarDays, label: "Calendar Update", color: "text-green-500" },
  google_calendar_delete: { icon: CalendarDays, label: "Calendar Delete", color: "text-red-400" },
  plan_task: { icon: Brain, label: "Plan Task", color: "text-teal-500" },
  delegate_task: { icon: Zap, label: "Delegate Task", color: "text-orange-500" },
};

function getToolMeta(name: string) {
  return TOOL_META[name] || { icon: Zap, label: name, color: "text-zinc-400" };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateStr(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

function AgentTraceCard({ trace }: { trace: TraceEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getToolMeta(trace.name);
  const Icon = meta.icon;

  const argsStr = JSON.stringify(trace.args, null, 2);
  const argsPreview = truncateStr(
    Object.entries(trace.args)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(", "),
    80,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="min-w-0 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex w-full min-w-0 items-center gap-2.5 rounded-lg bg-zinc-100/80 px-3 py-2 text-left transition-colors hover:bg-zinc-200/80 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/60"
      >
        {/* Status dot */}
        {trace.status === "running" ? (
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        ) : trace.status === "error" ? (
          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        )}

        {/* Tool icon and name */}
        <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
        <span className="shrink-0 text-xs font-medium text-zinc-700 dark:text-zinc-300">{meta.label}</span>

        {/* Args preview */}
        <span className="min-w-0 flex-1 truncate text-xs text-zinc-400 dark:text-zinc-500">
          {argsPreview}
        </span>

        {/* Latency badge */}
        {trace.durationMs != null && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
            trace.durationMs < 1000
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : trace.durationMs < 3000
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
          }`}>
            {formatDuration(trace.durationMs)}
          </span>
        )}

        {/* Truncation warning */}
        {trace.truncated && (
          <span title="Result truncated" className="flex shrink-0">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
          </span>
        )}

        {/* Expand chevron */}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mx-1 mt-1 mb-1 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-700/40 space-y-2">
              {/* Arguments */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                  Arguments
                </p>
                <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32">
                  {argsStr}
                </pre>
              </div>

              {/* Result */}
              {trace.result && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                    Result {trace.truncated && <span className="text-amber-400">(truncated)</span>}
                  </p>
                  <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-48">
                    {trace.result}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ThinkingCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="min-w-0 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex w-full min-w-0 items-center gap-2.5 rounded-lg bg-zinc-100/80 px-3 py-2 text-left transition-colors hover:bg-zinc-200/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/70"
      >
        <Brain className="h-3.5 w-3.5 text-teal-500 shrink-0" />
        <span className="shrink-0 text-xs font-medium text-zinc-700 dark:text-zinc-200">Reasoning</span>
        <span className="min-w-0 flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {truncateStr(content, 80)}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mx-1 mt-1 mb-1 rounded-lg border border-zinc-200/60 bg-zinc-50 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/50">
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                {content}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export interface AgentTraceTimelineProps {
  traces: TraceEvent[];
  thinking?: ThinkingEvent[];
  isStreaming?: boolean;
}

export function AgentTraceTimeline({ traces, thinking = [], isStreaming }: AgentTraceTimelineProps) {
  if (!traces.length && !thinking.length) return null;

  const items = buildTimelineItems(traces, thinking);

  return <TraceTimeline items={items} traces={traces} thinking={thinking} isStreaming={isStreaming} />;
}

function TraceTimeline({
  items,
  traces,
  thinking,
  isStreaming,
}: {
  items: ReturnType<typeof buildTimelineItems>;
  traces: TraceEvent[];
  thinking: ThinkingEvent[];
  isStreaming?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(isStreaming !== true);

  // Build summary label
  const thinkingCount = thinking.length;
  const toolCounts: Record<string, number> = {};
  for (const t of traces) {
    if (t.name !== "delegate_task") {
      toolCounts[t.name] = (toolCounts[t.name] || 0) + 1;
    }
  }
  const totalMs = traces.reduce((sum, t) => sum + (t.durationMs || 0), 0);
  const summaryParts: string[] = [];
  if (thinkingCount) summaryParts.push(thinkingCount === 1 ? "1 reasoning" : `${thinkingCount} reasonings`);
  for (const [name, count] of Object.entries(toolCounts)) {
    const label = getToolMeta(name).label.toLowerCase();
    summaryParts.push(count === 1 ? `1 ${label}` : `${count} ${label}s`);
  }
  const summaryText = summaryParts.join(" · ") || `${traces.length} steps`;
  const durationText = totalMs > 0 ? ` · ${formatDuration(totalMs)}` : "";

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300"
      >
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span>{summaryText}{durationText}</span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5 mb-2">
      {!isStreaming && (
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300"
        >
          <ChevronDown className="h-3 w-3 shrink-0" />
          <span>Hide steps</span>
        </button>
      )}
      <TimelineItemsList items={items} />
    </div>
  );
}

type TimelineItem =
  | { type: "trace"; trace: TraceEvent; order: number }
  | { type: "thinking"; thinking: ThinkingEvent; order: number };

function TimelineItemsList({ items }: { items: TimelineItem[] }) {
  const groupedItems = groupTimelineItems(items);

  return (
    <AnimatePresence>
      {groupedItems.map((item, index) =>
        item.type === "delegation" ? (
          <DelegationTraceGroup
            key={`delegation-${item.header.callId}-${index}`}
            agentName={item.agentName}
            header={item.header}
            items={item.items}
          />
        ) : item.item.type === "trace" ? (
          <AgentTraceCard key={`trace-${item.item.trace.callId}-${index}`} trace={item.item.trace} />
        ) : (
          <ThinkingCard
            key={`thinking-${item.item.thinking.agentName || "main"}-${item.item.order}-${index}`}
            content={item.item.thinking.content}
          />
        ),
      )}
    </AnimatePresence>
  );
}

function DelegationTraceGroup({
  agentName,
  header,
  items,
}: {
  agentName: string;
  header: TraceEvent;
  items: TimelineItem[];
}) {
  const [expanded, setExpanded] = useState(true);
  const nestedTraceCount = items.filter((item) => item.type === "trace").length;
  const totalDuration = items.reduce(
    (sum, item) => sum + (item.type === "trace" ? item.trace.durationMs || 0 : 0),
    0,
  );
  const task = typeof header.args.task === "string" ? header.args.task : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-orange-200/70 bg-orange-50/70 px-3 py-2 text-left transition-colors hover:bg-orange-100/70 dark:border-orange-900/40 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
      >
        {header.status === "running" ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
        ) : header.status === "error" ? (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
        )}
        <Zap className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          {agentName.replace(/_/g, " ")}
        </span>
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {task || "Delegated task"}
        </span>
        <span className="ml-auto text-[10px] font-mono text-zinc-400">
          {nestedTraceCount} calls{totalDuration ? ` • ${formatDuration(totalDuration)}` : ""}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-4 mt-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
              <TimelineItemsList items={items} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function buildTimelineItems(traces: TraceEvent[], thinking: ThinkingEvent[]): TimelineItem[] {
  return [
    ...traces.map((trace, index) => ({
      type: "trace" as const,
      trace,
      order: trace.order ?? index,
    })),
    ...thinking.map((entry, index) => ({
      type: "thinking" as const,
      thinking: entry,
      order: entry.order ?? traces.length + index,
    })),
  ].sort((a, b) => a.order - b.order);
}

function groupTimelineItems(items: TimelineItem[]): Array<
  | { type: "item"; item: TimelineItem }
  | { type: "delegation"; agentName: string; header: TraceEvent; items: TimelineItem[] }
> {
  const grouped: Array<
    | { type: "item"; item: TimelineItem }
    | { type: "delegation"; agentName: string; header: TraceEvent; items: TimelineItem[] }
  > = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.type !== "trace" || item.trace.name !== "delegate_task" || !item.trace.agentName) {
      grouped.push({ type: "item", item });
      continue;
    }

    const nested: TimelineItem[] = [];
    let cursor = index + 1;
    while (cursor < items.length && getTimelineItemAgentName(items[cursor]) === item.trace.agentName) {
      nested.push(items[cursor]);
      cursor += 1;
    }

    grouped.push({
      type: "delegation",
      agentName: item.trace.agentName,
      header: item.trace,
      items: nested,
    });
    index = cursor - 1;
  }

  return grouped;
}

function getTimelineItemAgentName(item: TimelineItem): string | undefined {
  return item.type === "trace" ? item.trace.agentName : item.thinking.agentName;
}
