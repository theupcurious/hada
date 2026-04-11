import type { AgentTool } from "@/lib/chat/agent-loop";

import type { ToolManifest } from "@/lib/chat/tools/tool-registry";

const MAX_FETCH_CHARS = 24_000;
const FETCH_TIMEOUT_MS = 12_000;

export const webFetchManifest: ToolManifest = {
  name: "web_fetch",
  displayName: "Web Fetch",
  description: "Fetch and extract readable content from a public URL.",
  category: "web",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Public HTTP(S) URL to fetch.",
      },
    },
    required: ["url"],
  },
};

export function createWebFetchTool(): AgentTool {
  return {
    name: webFetchManifest.name,
    description: webFetchManifest.description,
    parameters: webFetchManifest.parameters,
    async execute(args, options) {
      const rawUrl = String(args.url || "").trim();
      if (!rawUrl) {
        return JSON.stringify({ success: false, error: "url is required" });
      }

      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return JSON.stringify({ success: false, error: "invalid URL" });
      }

      if (!/^https?:$/i.test(url.protocol)) {
        return JSON.stringify({ success: false, error: "only HTTP(S) URLs are allowed" });
      }

      try {
        const signals = [AbortSignal.timeout(FETCH_TIMEOUT_MS)];
        if (options?.signal) signals.push(options.signal);
        const signal = AbortSignal.any(signals);

        const response = await fetch(url.toString(), {
          signal,
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Upgrade-Insecure-Requests": "1",
          },
        });

        if (!response.ok) {
          return JSON.stringify({
            success: false,
            error: `fetch failed (${response.status})`,
          });
        }

        const contentType = response.headers.get("content-type") || "";
        const body = await response.text();
        const extracted = contentType.includes("text/html")
          ? htmlToText(body)
          : body;

        return JSON.stringify({
          success: true,
          url: url.toString(),
          content: extracted.slice(0, MAX_FETCH_CHARS),
          truncated: extracted.length > MAX_FETCH_CHARS,
        });
      } catch (error) {
        if (isAbortError(error)) {
          // Re-throw only if the agent itself was cancelled, not a local timeout.
          if (options?.signal?.aborted) throw error;
          return JSON.stringify({ success: false, error: "fetch timed out" });
        }
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "fetch failed",
        });
      }
    },
  };
}

function htmlToText(html: string): string {
  // Strip boilerplate blocks before any tag processing
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Common non-content regions by tag+role/class heuristics
    .replace(/<(nav|header|footer|aside|banner|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*(role=["'](navigation|banner|contentinfo|complementary)["'])[^>]*>[\s\S]*?<\/[^>]+>/gi, "");

  // Try to extract a semantic content region
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*\b(?:class|id)=["'][^"']*\b(?:article|post|content|story|body|entry|text|prose)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*\b(?:class|id)=["'][^"']*\b(?:article|post|content|story|body)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
  ];

  let source = stripped;
  for (const pattern of contentPatterns) {
    const match = stripped.match(pattern);
    if (match && match[1] && match[1].length > 500) {
      source = match[1];
      break;
    }
  }

  return source
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError";
}
