import type { TraceEvent } from "@/lib/chat/types";

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

  const searchTraces = input.traces.filter((trace) => trace.name === "web_search");
  const fetchTraces = input.traces.filter((trace) => trace.name === "web_fetch");
  const delegateTraces = input.traces.filter((trace) => trace.name === "delegate_task");
  const createDocumentTraces = input.traces.filter((trace) => trace.name === "create_document");
  const updateDocumentTraces = input.traces.filter((trace) => trace.name === "update_document");
  const runningSearch = searchTraces.some((trace) => trace.status === "running");
  const runningFetch = fetchTraces.some((trace) => trace.status === "running");
  const runningDelegate = delegateTraces.some((trace) => trace.status === "running");
  const runningCreateDocument = createDocumentTraces.some((trace) => trace.status === "running");
  const runningUpdateDocument = updateDocumentTraces.some((trace) => trace.status === "running");
  const hasRunningTool =
    runningSearch ||
    runningFetch ||
    runningDelegate ||
    runningCreateDocument ||
    runningUpdateDocument;
  const hasToolHistory =
    searchTraces.length > 0 ||
    fetchTraces.length > 0 ||
    delegateTraces.length > 0 ||
    createDocumentTraces.length > 0 ||
    updateDocumentTraces.length > 0;
  const fetchCount = fetchTraces.length;

  const pills: ToolStatusPill[] = [];

  if (runningSearch) {
    pills.push({ id: "search", label: "Searching web", tone: "working" });
  }

  if (runningFetch && fetchCount > 0) {
    pills.push({
      id: "fetch",
      label: `Reading ${fetchCount} source${fetchCount === 1 ? "" : "s"}`,
      tone: "working",
    });
  }

  if (runningDelegate) {
    pills.push({ id: "delegate", label: "Research agent working", tone: "working" });
  }

  if (runningCreateDocument) {
    pills.push({ id: "create-document", label: "Writing document", tone: "working" });
  }

  if (runningUpdateDocument) {
    pills.push({ id: "update-document", label: "Updating document", tone: "working" });
  }

  if (input.backgroundJobPending) {
    pills.push({ id: "background", label: "Working in background", tone: "neutral" });
  }

  if (!hasRunningTool && hasToolHistory && !input.hasVisibleContent && input.thinkingCount === 0) {
    pills.push({ id: "analyzing", label: "Analyzing findings", tone: "working" });
  }

  if (!hasRunningTool && (input.hasVisibleContent || input.thinkingCount > 0)) {
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
