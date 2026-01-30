import { checkHealth } from '@/lib/moltbot/client';
import { NextResponse } from 'next/server';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
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

/**
 * GET /api/health
 * Returns the health status of the bot server and its dependencies.
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const gatewayConnected = await checkHealth();
  const llmConfigured = !!process.env.LLM_API_KEY;
  const llmProvider = process.env.LLM_PROVIDER || 'minimax';

  let status: HealthStatus['status'];
  if (gatewayConnected) {
    status = 'healthy';
  } else if (llmConfigured) {
    status = 'degraded'; // Gateway down but fallback available
  } else {
    status = 'unhealthy';
  }

  return NextResponse.json({
    status,
    gateway: {
      connected: gatewayConnected,
      url: process.env.MOLTBOT_GATEWAY_URL || 'ws://localhost:18789',
      lastCheck: new Date().toISOString(),
    },
    llmFallback: {
      available: llmConfigured,
      provider: llmConfigured ? llmProvider : null,
    },
    timestamp: new Date().toISOString(),
  });
}
