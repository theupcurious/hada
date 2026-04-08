import { NextResponse } from "next/server";
import { PROVIDERS, DEFAULT_PROVIDER, resolveProviderSelection } from "@/lib/chat/providers";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { LLMProviderName } from "@/lib/types/database";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  gateway: {
    connected: boolean;
    url: string;
    lastCheck: string;
  };
  llmFallback: {
    available: boolean;
    provider: string | null;
  };
  timestamp: string;
  debug?: {
    provider: string;
    baseUrl: string;
    model: string;
    authHeader: string;
    keyPrefix: string;
  };
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const provider = String(process.env.LLM_PROVIDER || DEFAULT_PROVIDER).toLowerCase() as LLMProviderName;
  const selected = PROVIDERS[provider] ? provider : DEFAULT_PROVIDER;
  const llmConfigured = Boolean(process.env.LLM_API_KEY);
  let visibleProvider: string | null = null;
  let debug: HealthStatus["debug"] | undefined;

  try {
    const supabase = await createClient();
    const { user, error } = await getAuthenticatedUser(supabase);

    if (!error && user && isAdminEmail(user.email)) {
      visibleProvider = selected;
      try {
        const sel = resolveProviderSelection();
        debug = {
          provider: sel.provider,
          baseUrl: sel.config.baseUrl,
          model: sel.model,
          authHeader: sel.config.apiKeyHeader ?? "Authorization (Bearer)",
          keyPrefix: sel.apiKey ? sel.apiKey.slice(0, 10) + "..." : "(empty)",
        };
      } catch {
        // resolveProviderSelection throws if key is missing — that's fine here.
      }
    }
  } catch {
    // Ignore auth errors on health checks and keep provider hidden.
  }

  return NextResponse.json({
    status: llmConfigured ? "healthy" : "unhealthy",
    gateway: {
      connected: llmConfigured,
      url: "agent-loop",
      lastCheck: new Date().toISOString(),
    },
    llmFallback: {
      available: llmConfigured,
      provider: llmConfigured ? visibleProvider : null,
    },
    timestamp: new Date().toISOString(),
    debug,
  });
}
