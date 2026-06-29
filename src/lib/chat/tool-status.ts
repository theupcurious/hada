import type { TraceEvent } from "@/lib/chat/types";
import { getToolLabel } from "@/lib/chat/tool-labels";

export interface ToolStatusInput {
  isStreaming: boolean;
  traces: TraceEvent[];
  thinkingCount: number;
  hasVisibleContent: boolean;
  backgroundJobPending: boolean;
}

export interface ToolStatusPill {
  id: string;
  label: string;
  tone: "neutral" | "working" | "success" | "warning";
}

export function buildToolStatusPills(input: ToolStatusInput): ToolStatusPill[] {
  if (!input.isStreaming) {
    return [];
  }

  const hasToolHistory = input.traces.length > 0;
  const runningTraces = input.traces.filter((trace) => trace.status === "running");
  const hasRunningTool = runningTraces.length > 0;

  const pills: ToolStatusPill[] = [];

  // One pill per distinct tool that is currently running, in first-seen order,
  // with a plain-language label from the shared registry. web_fetch is special
  // cased to show how many sources are being read.
  const seenRunning = new Set<string>();
  const fetchCount = input.traces.filter((trace) => trace.name === "web_fetch").length;

  for (const trace of runningTraces) {
    if (seenRunning.has(trace.name)) {
      continue;
    }
    seenRunning.add(trace.name);

    if (trace.name === "web_fetch") {
      if (fetchCount > 0) {
        pills.push({
          id: "web_fetch",
          label: `Reading ${fetchCount} source${fetchCount === 1 ? "" : "s"}`,
          tone: "working",
        });
      }
      continue;
    }

    pills.push({
      id: trace.name,
      label: getToolLabel(trace.name).present,
      tone: "working",
    });
  }

  if (input.backgroundJobPending) {
    pills.push({ id: "background", label: "Working in background", tone: "neutral" });
  }

  if (input.thinkingCount > 0) {
    pills.push({ id: "thinking", label: "Thinking...", tone: "working" });
  }

  if (!hasRunningTool && hasToolHistory && !input.hasVisibleContent && input.thinkingCount === 0) {
    pills.push({ id: "analyzing", label: "Analyzing findings", tone: "working" });
  }

  if (!hasRunningTool && input.hasVisibleContent) {
    pills.push({ id: "drafting", label: "Drafting response", tone: "working" });
  }

  return dedupePills(pills);
}

function dedupePills(pills: ToolStatusPill[]): ToolStatusPill[] {
  const seen = new Set<string>();
  return pills.filter((pill) => {
    if (seen.has(pill.id)) return false;
    seen.add(pill.id);
    return true;
  });
}
