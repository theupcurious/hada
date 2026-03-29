export interface ToolStatusInput {
  isStreaming: boolean;
  traces: Array<{ name: string; status: "running" | "done" | "error" }>;
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

  const hasSearch = input.traces.some((trace) => trace.name === "web_search");
  const fetchCount = input.traces.filter((trace) => trace.name === "web_fetch").length;
  const hasDelegate = input.traces.some((trace) => trace.name === "delegate_task");

  const pills: ToolStatusPill[] = [];

  if (hasSearch) {
    pills.push({ id: "search", label: "Searching web", tone: "working" });
  }

  if (fetchCount > 0) {
    pills.push({
      id: "fetch",
      label: `Reading ${fetchCount} source${fetchCount === 1 ? "" : "s"}`,
      tone: "neutral",
    });
  }

  if (hasDelegate) {
    pills.push({ id: "delegate", label: "Research agent working", tone: "neutral" });
  }

  if (input.backgroundJobPending) {
    pills.push({ id: "background", label: "Working in background", tone: "neutral" });
  }

  if (input.hasVisibleContent || input.thinkingCount > 0) {
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
