import type { AgentTool } from "@/lib/chat/agent-loop";

import type { ToolManifest } from "@/lib/chat/tools/tool-registry";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
}

const MAX_TITLE_CHARS = 120;
const MAX_SNIPPET_CHARS = 240;
const CURRENT_INFO_PATTERN =
  /\b(today|current|currently|latest|recent|recently|new|news|updated|update|as of|verify|verified|tomorrow|yesterday|this week|this month|this year)\b/i;
const FINANCE_PATTERN =
  /\b(market|markets|stock|stocks|equity|equities|bond|bonds|yield|yields|treasury|treasuries|fed|fomc|cpi|ppi|pce|inflation|jobs|payrolls|unemployment|earnings|oil|gold|bitcoin|btc|ethereum|eth|fx|forex|usd|eur|jpy|nasdaq|dow|s&p|spx|rates?)\b/i;
const EXPLICIT_DATE_PATTERN =
  /\b(20\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|q[1-4])\b/i;

export const webSearchManifest: ToolManifest = {
  name: "web_search",
  displayName: "Web Search",
  description: "Search the web for current information and return top results.",
  category: "web",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query.",
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return (default 10, max 20).",
      },
    },
    required: ["query"],
  },
};

export function createWebSearchTool(): AgentTool {
  return {
    name: webSearchManifest.name,
    description: webSearchManifest.description,
    parameters: webSearchManifest.parameters,
    async execute(args, options) {
      const query = String(args.query || "").trim();
      const maxResults = Math.max(
        1,
        Math.min(Number(args.max_results || 10) || 10, 20),
      );

      if (!query) {
        return JSON.stringify({ success: false, error: "query is required" });
      }

      const searchContext = buildSearchContext(query, new Date());
      const provider = (process.env.SEARCH_PROVIDER || "tavily").toLowerCase();
      const apiKey = resolveSearchApiKey(provider);

      if (!apiKey) {
        return JSON.stringify({
          success: false,
          error: `Search API key not configured for provider "${provider}". Set SEARCH_API_KEY or provider-specific keys.`,
        });
      }

      try {
        let results: SearchResult[] = [];
        if (provider === "serpapi") {
          results = await searchSerpAPI(searchContext, maxResults, apiKey, options?.signal);
        } else if (provider === "brave") {
          results = await searchBrave(searchContext, maxResults, apiKey, options?.signal);
        } else {
          results = await searchTavily(searchContext, maxResults, apiKey, options?.signal);
        }

        return JSON.stringify({
          success: true,
          provider,
          query,
          effective_query: searchContext.effectiveQuery,
          freshness_sensitive: searchContext.freshnessSensitive,
          results: results.map((result, index) => ({
            rank: index + 1,
            title: clampText(result.title, MAX_TITLE_CHARS),
            url: result.url,
            snippet: clampText(result.snippet, MAX_SNIPPET_CHARS),
            ...(result.publishedAt ? { published_at: result.publishedAt } : {}),
          })),
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Search failed",
        });
      }
    },
  };
}

function resolveSearchApiKey(provider: string): string {
  const shared = (process.env.SEARCH_API_KEY || "").trim();
  if (shared) {
    return shared;
  }

  if (provider === "brave") {
    return (process.env.BRAVE_API_KEY || "").trim();
  }

  if (provider === "serpapi") {
    return (process.env.SERPAPI_API_KEY || "").trim();
  }

  return (process.env.TAVILY_API_KEY || "").trim();
}

async function searchTavily(
  context: SearchContext,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: context.effectiveQuery,
      max_results: maxResults,
      ...(context.freshnessSensitive
        ? {
            topic: "news",
            days: 30,
            search_depth: "advanced",
          }
        : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await formatSearchError("Tavily request failed", response));
  }

  const data = await response.json();
  return toSearchResults(data?.results || [], {
    title: "title",
    url: "url",
    snippet: "content",
    publishedAt: ["published_date"],
  });
}

async function searchSerpAPI(
  context: SearchContext,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", context.effectiveQuery);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(maxResults));
  if (context.freshnessSensitive) {
    url.searchParams.set("tbm", "nws");
    url.searchParams.set("tbs", "qdr:m");
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(await formatSearchError("SerpAPI request failed", response));
  }

  const data = await response.json();
  const rows = context.freshnessSensitive ? data?.news_results || data?.organic_results || [] : data?.organic_results || [];
  return toSearchResults(rows.slice(0, maxResults), {
    title: "title",
    url: "link",
    snippet: "snippet",
    publishedAt: ["date"],
  });
}

async function searchBrave(
  context: SearchContext,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", context.effectiveQuery);
  url.searchParams.set("count", String(maxResults));

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(await formatSearchError("Brave Search request failed", response));
  }

  const data = await response.json();
  return toSearchResults((data?.web?.results || []).slice(0, maxResults), {
    title: "title",
    url: "url",
    snippet: "description",
    publishedAt: ["page_age", "age"],
  });
}

function toSearchResults(
  input: unknown[],
  fields: { title: string; url: string; snippet: string; publishedAt?: string[] },
): SearchResult[] {
  return input.map((item) => {
    const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      title: String(record[fields.title] || "Untitled"),
      url: String(record[fields.url] || ""),
      snippet: String(record[fields.snippet] || ""),
      publishedAt: firstString(record, fields.publishedAt),
    };
  });
}

async function formatSearchError(prefix: string, response: Response): Promise<string> {
  const body = await safeResponseText(response);
  return body
    ? `${prefix}: ${response.status} ${body.slice(0, 300)}`
    : `${prefix}: ${response.status}`;
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function clampText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars).trimEnd()}…`;
}

interface SearchContext {
  originalQuery: string;
  effectiveQuery: string;
  freshnessSensitive: boolean;
}

export function buildSearchContext(query: string, now: Date): SearchContext {
  const trimmedQuery = query.trim();
  const freshnessSensitive = isFreshnessSensitiveQuery(trimmedQuery);

  return {
    originalQuery: trimmedQuery,
    effectiveQuery: freshnessSensitive ? applyFreshnessBias(trimmedQuery, now) : trimmedQuery,
    freshnessSensitive,
  };
}

export function isFreshnessSensitiveQuery(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) {
    return false;
  }

  return CURRENT_INFO_PATTERN.test(normalized) || FINANCE_PATTERN.test(normalized);
}

function applyFreshnessBias(query: string, now: Date): string {
  if (EXPLICIT_DATE_PATTERN.test(query)) {
    return query;
  }

  return `${query} ${formatSearchDate(now)} latest`;
}

function formatSearchDate(now: Date): string {
  return now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function firstString(record: Record<string, unknown>, fields?: string[]): string | null {
  if (!fields?.length) {
    return null;
  }

  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}
