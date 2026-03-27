import type { RichCard, SearchResultItem, SearchResultsCardPayload } from "@/lib/types/cards";

type ToolResultForExtraction = {
  name: string;
  result: string;
  args?: Record<string, unknown>;
};

const MAX_SEARCH_RESULTS = 5;

export function extractCardsFromToolResults(toolResults: ToolResultForExtraction[]): RichCard[] {
  const cards: RichCard[] = [];

  // Only show search result cards when web_search was the sole tool used.
  // When the agent uses other tools alongside web_search (calendar, memory, etc.)
  // it is synthesising an answer — the raw search results are noise, not signal.
  const toolNames = new Set(toolResults.map((t) => t.name));
  const isPureSearchRun = toolNames.size === 1 && toolNames.has("web_search");

  if (!isPureSearchRun) {
    return cards;
  }

  for (const tool of toolResults) {
    if (tool.name === "web_search") {
      const card = extractSearchResultsCard(tool);
      if (card) {
        cards.push(card);
      }
    }
  }

  return cards;
}

function extractSearchResultsCard(tool: ToolResultForExtraction): SearchResultsCardPayload | null {
  const parsed = safeParseJson(tool.result);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (record.success !== true || !Array.isArray(record.results)) {
    return null;
  }

  const query = typeof tool.args?.query === "string" ? tool.args.query.trim() : "";
  const results = record.results
    .map((item) => normalizeSearchResult(item))
    .filter((item): item is SearchResultItem => Boolean(item))
    .slice(0, MAX_SEARCH_RESULTS);

  if (!results.length) {
    return null;
  }

  return {
    type: "search_results",
    data: {
      query,
      results,
    },
  };
}

function normalizeSearchResult(item: unknown): SearchResultItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const url = typeof record.url === "string" ? record.url.trim() : "";
  const snippet =
    typeof record.snippet === "string"
      ? record.snippet.trim()
      : typeof record.content === "string"
        ? record.content.trim()
        : "";

  if (!title || !url) {
    return null;
  }

  const source = extractDomain(url);
  return {
    title,
    url,
    snippet,
    ...(source ? { source } : {}),
    ...(source ? { favicon: buildFaviconUrl(source) } : {}),
  };
}

function buildFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
