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
    async execute(args) {
      const query = String(args.query || "").trim();
      const maxResults = Math.max(
        1,
        Math.min(Number(args.max_results || 5) || 5, 10),
      );

      if (!query) {
        return JSON.stringify({ success: false, error: "query is required" });
      }

      const provider = (process.env.SEARCH_PROVIDER || "tavily").toLowerCase();
      const apiKey = process.env.SEARCH_API_KEY;

      if (!apiKey) {
        return JSON.stringify({ success: false, error: "SEARCH_API_KEY is not configured" });
      }

      try {
        let results: SearchResult[] = [];
        if (provider === "serpapi") {
          results = await searchSerpAPI(query, maxResults, apiKey);
        } else if (provider === "brave") {
          results = await searchBrave(query, maxResults, apiKey);
        } else {
          results = await searchTavily(query, maxResults, apiKey);
        }

        return JSON.stringify({ success: true, provider, query, results });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Search failed",
        });
      }
    },
  };
}

async function searchTavily(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
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
    throw new Error(`Tavily request failed: ${response.status}`);
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
): Promise<SearchResult[]> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(maxResults));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpAPI request failed: ${response.status}`);
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
): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search request failed: ${response.status}`);
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
