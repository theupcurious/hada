export function isLongJobMessage(message: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim().toLowerCase();

  const longJobHints = [
    "research",
    "deep dive",
    "write a memo",
    "write me a memo",
    "memo",
    "report",
    "analyze",
    "analysis",
    "compare",
    "comparison",
    "summarize",
    "summary",
    "search the web",
    "search multiple sources",
    "read the most relevant",
    "latest developments",
    "latest news",
    "comprehensive",
    "detailed",
    "investigate",
  ];

  return normalized.length >= 180 || longJobHints.some((hint) => normalized.includes(hint));
}

export function resolveRunBudget(message: string): {
  timeoutMs: number;
  idleTimeoutMs: number;
} {
  if (isLongJobMessage(message)) {
    return {
      timeoutMs: 285_000,
      idleTimeoutMs: 180_000,
    };
  }

  return {
    timeoutMs: 240_000,
    idleTimeoutMs: 150_000,
  };
}
