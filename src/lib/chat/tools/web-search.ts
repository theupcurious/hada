import type { AgentTool } from "@/lib/chat/agent-loop";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export function createWebSearchTool(): AgentTool {
  return {
    name: "web_search",
    description: "Search the web for current information and return top results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default 5, max 10).",
        },
      },
      required: ["query"],
    },
    async execute(args, options) {
      const query = String(args.query || "").trim();
      const maxResults = Math.max(
        1,
        Math.min(Number(args.max_results || 5) || 5, 10),
      );

      if (!query) {
        return JSON.stringify({ success: false, error: "query is required" });
      }

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
          results = await searchSerpAPI(query, maxResults, apiKey, options?.signal);
        } else if (provider === "brave") {
          results = await searchBrave(query, maxResults, apiKey, options?.signal);
        } else {
          results = await searchTavily(query, maxResults, apiKey, options?.signal);
        }

        return JSON.stringify({ success: true, provider, query, results });
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
    return (
      (process.env.BRAVE_SEARCH_API_KEY || "").trim() ||
      (process.env.BRAVE_API_KEY || "").trim()
    );
  }

  if (provider === "serpapi") {
    return (process.env.SERPAPI_API_KEY || "").trim();
  }

  return (process.env.TAVILY_API_KEY || "").trim();
}

async function searchTavily(
  query: string,
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
      query,
      max_results: maxResults,
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
  });
}

async function searchSerpAPI(
  query: string,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(maxResults));

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(await formatSearchError("SerpAPI request failed", response));
  }

  const data = await response.json();
  return toSearchResults((data?.organic_results || []).slice(0, maxResults), {
    title: "title",
    url: "link",
    snippet: "snippet",
  });
}

async function searchBrave(
  query: string,
  maxResults: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
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
  });
}

function toSearchResults(
  input: unknown[],
  fields: { title: string; url: string; snippet: string },
): SearchResult[] {
  return input.map((item) => {
    const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      title: String(record[fields.title] || "Untitled"),
      url: String(record[fields.url] || ""),
      snippet: String(record[fields.snippet] || ""),
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
