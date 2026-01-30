'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HealthStatus } from '@/app/api/health/route';

export type ConnectionStatus = 'connecting' | 'connected' | 'degraded' | 'disconnected';

export interface UseHealthStatusResult {
  status: ConnectionStatus;
  health: HealthStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to track bot server health status.
 * Polls the health endpoint at the specified interval.
 */
export function useHealthStatus(pollInterval: number = 10000): UseHealthStatusResult {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      const data: HealthStatus = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchHealth();

    // Set up polling
    const interval = setInterval(fetchHealth, pollInterval);

    return () => clearInterval(interval);
  }, [fetchHealth, pollInterval]);

  // Derive connection status from health data
  const status: ConnectionStatus = (() => {
    if (isLoading && !health) return 'connecting';
    if (!health) return 'disconnected';
    if (health.gateway.connected) return 'connected';
    if (health.llmFallback.available) return 'degraded';
    return 'disconnected';
  })();

  return {
    status,
    health,
    isLoading,
    error,
    refresh: fetchHealth,
  };
}
