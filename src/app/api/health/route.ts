import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/chat/providers";
import { isAdminEmail } from "@/lib/auth/admin";
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
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const provider = String(process.env.LLM_PROVIDER || "minimax").toLowerCase() as LLMProviderName;
  const selected = PROVIDERS[provider] ? provider : "minimax";
  const keyEnv = PROVIDERS[selected].apiKeyEnv;
  const llmConfigured = Boolean(process.env[keyEnv] || process.env.LLM_API_KEY);
  let visibleProvider: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user && isAdminEmail(user.email)) {
      visibleProvider = selected;
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
  });
}
