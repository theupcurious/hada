const DEFAULT_GATEWAY_URL = 'ws://localhost:18789';
const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/v1';
const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.1';

function normalizeProvider(raw?: string): string {
  const cleaned = (raw || 'minimax').split('#')[0]?.trim().toLowerCase();
  return cleaned || 'minimax';
}

export const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || process.env.MOLTBOT_GATEWAY_URL || DEFAULT_GATEWAY_URL;
export const GATEWAY_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || process.env.MOLTBOT_GATEWAY_TOKEN || 'hada-dev-token-12345';
export const LLM_PROVIDER = normalizeProvider(process.env.LLM_PROVIDER);
export const LLM_API_KEY =
  process.env.LLM_API_KEY ||
  (LLM_PROVIDER === 'minimax' ? process.env.MINIMAX_API_KEY : undefined) ||
  (LLM_PROVIDER === 'anthropic' ? process.env.ANTHROPIC_API_KEY : undefined) ||
  (LLM_PROVIDER === 'openai' ? process.env.OPENAI_API_KEY : undefined);
export const MINIMAX_BASE_URL = (process.env.MINIMAX_BASE_URL || DEFAULT_MINIMAX_BASE_URL).replace(
  /\/+$/,
  ''
);
export const MINIMAX_MODEL = process.env.MINIMAX_MODEL || DEFAULT_MINIMAX_MODEL;
