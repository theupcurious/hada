/**
 * OpenClaw Gateway Client
 *
 * Connects to the OpenClaw Gateway or falls back to direct LLM API.
 * This allows the chat to work even before OpenClaw is fully configured.
 */

import { LLM_API_KEY, LLM_PROVIDER, MINIMAX_BASE_URL, MINIMAX_MODEL } from './config';
import { sendMessageViaWebSocket } from './websocket-client';

export interface OpenClawResponse {
  content: string;
  thinking?: string;
  done: boolean;
  error?: string;
  gatewayError?: { code: string; message: string };
  source: 'gateway' | 'fallback';
}

/**
 * Strip <think>...</think> tags from LLM response and extract thinking content
 */
function processThinkingTags(content: string): { content: string; thinking?: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const matches = content.match(thinkRegex);

  if (!matches) {
    return { content: content.trim() };
  }

  // Extract thinking content
  const thinkingParts: string[] = [];
  matches.forEach(match => {
    const inner = match.replace(/<\/?think>/gi, '').trim();
    if (inner) thinkingParts.push(inner);
  });

  // Remove thinking tags from content
  const cleanContent = content.replace(thinkRegex, '').trim();

  return {
    content: cleanContent,
    thinking: thinkingParts.length > 0 ? thinkingParts.join('\n') : undefined,
  };
}

/**
 * Send a message and get a response
 * Tries OpenClaw Gateway (WebSocket) first, falls back to direct LLM API
 */
export async function sendMessage(
  message: string,
  sessionId: string,
  userId: string,
  userName?: string
): Promise<OpenClawResponse> {
  const trimmedName = userName?.trim();
  const gatewayMessage = trimmedName
    ? `User profile: name is ${trimmedName}.\n\nUser message: ${message}`
    : message;

  // Try OpenClaw Gateway via WebSocket first
  const gatewayAttempt = await tryGatewayWebSocket(gatewayMessage, sessionId);
  if (gatewayAttempt.response) {
    return gatewayAttempt.response;
  }

  // Fallback to direct LLM API, but surface gateway error if it failed.
  const fallback = await fallbackToLLM(message, sessionId, userId, trimmedName);
  if (gatewayAttempt.error) {
    return { ...fallback, gatewayError: gatewayAttempt.error };
  }
  return fallback;
}

/**
 * Try to connect to OpenClaw Gateway via WebSocket
 */
async function tryGatewayWebSocket(
  message: string,
  sessionId: string
): Promise<{ response?: OpenClawResponse; error?: { code: string; message: string } }> {
  try {
    const result = await sendMessageViaWebSocket(message, sessionId);

    if (result && 'error' in result) {
      return {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      };
    }

    if (result && 'content' in result) {
      const processed = processThinkingTags(result.content);
      return {
        response: {
          content: processed.content,
          thinking: processed.thinking,
          done: true,
          source: 'gateway',
        },
      };
    }

    return {
      error: {
        code: 'gateway_empty_response',
        message: 'Gateway returned an empty response.',
      },
    };
  } catch (error) {
    console.error('WebSocket gateway error:', error);
    return {
      error: {
        code: 'gateway_exception',
        message: error instanceof Error ? error.message : 'Unknown gateway error',
      },
    };
  }
}

/**
 * Fallback to direct LLM API when Gateway is not available
 */
async function fallbackToLLM(
  message: string,
  sessionId: string,
  userId: string,
  userName?: string
): Promise<OpenClawResponse> {
  if (!LLM_API_KEY) {
    return {
      content: "I'm not fully configured yet. Please set up the LLM API key in environment variables.",
      done: true,
      error: 'No API key configured',
      source: 'fallback',
    };
  }

  try {
    const systemPrompt = `You are Hada, a helpful AI assistant. You help users manage their calendar, draft emails, book appointments, do research, and handle tasks. Be concise, friendly, and proactive.

Current session: ${sessionId}
User ID: ${userId}${userName ? `\nUser name: ${userName}` : ''}`;

    let response: Response;

    if (LLM_PROVIDER === 'anthropic') {
      response = await callAnthropic(message, systemPrompt);
    } else if (LLM_PROVIDER === 'openai') {
      response = await callOpenAI(message, systemPrompt);
    } else {
      // Default to MiniMax
      response = await callMiniMax(message, systemPrompt);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API error status:', response.status);
      console.error('LLM API error body:', errorText);
      console.error('LLM Provider:', LLM_PROVIDER);
      return {
        content: "I'm having trouble processing your request. Please try again.",
        done: true,
        error: `API error: ${response.status}`,
        source: 'fallback',
      };
    }

    const data = await response.json();
    const rawContent = extractContent(data, LLM_PROVIDER);
    const processed = processThinkingTags(rawContent);

    return {
      content: processed.content,
      thinking: processed.thinking,
      done: true,
      source: 'fallback',
    };
  } catch (error) {
    console.error('LLM fallback error:', error);
    return {
      content: "Sorry, I encountered an error. Please try again.",
      done: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'fallback',
    };
  }
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(message: string, systemPrompt: string): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LLM_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    }),
  });
}

/**
 * Call OpenAI API
 */
async function callOpenAI(message: string, systemPrompt: string): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    }),
  });
}

/**
 * Call MiniMax API
 */
async function callMiniMax(message: string, systemPrompt: string): Promise<Response> {
  return fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    }),
  });
}

/**
 * Extract content from LLM response based on provider
 */
function extractContent(data: Record<string, unknown>, provider: string): string {
  if (provider === 'anthropic') {
    const content = data.content as Array<{ text?: string }>;
    return content?.[0]?.text || '';
  } else if (provider === 'openai') {
    const choices = data.choices as Array<{ message?: { content?: string } }>;
    return choices?.[0]?.message?.content || '';
  } else {
    // MiniMax
    const choices = data.choices as Array<{ message?: { content?: string } }>;
    return choices?.[0]?.message?.content || '';
  }
}

/**
 * Check if the Gateway is healthy (via WebSocket)
 */
export async function checkHealth(): Promise<boolean> {
  const { checkGatewayConnection } = await import('./websocket-client');
  return checkGatewayConnection();
}
