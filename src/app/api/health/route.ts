import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/chat/providers";
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

  return NextResponse.json({
    status: llmConfigured ? "healthy" : "unhealthy",
    gateway: {
      connected: llmConfigured,
      url: "agent-loop",
      lastCheck: new Date().toISOString(),
    },
    llmFallback: {
      available: llmConfigured,
      provider: llmConfigured ? selected : null,
    },
    timestamp: new Date().toISOString(),
  });
}
