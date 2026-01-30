import { createClient } from '@/lib/supabase/server';
import { sendMessage, checkHealth } from '@/lib/moltbot/client';
import { getOrCreateConversation, saveMessage } from '@/lib/db/conversations';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get or create the user's conversation
    const conversation = await getOrCreateConversation(supabase, user.id);

    // Save user message to database
    const userMessage = await saveMessage(
      supabase,
      conversation.id,
      'user',
      message
    );

    // Send message to moltbot (sessionKey = userId for single persistent session)
    const response = await sendMessage(message, user.id, user.id);

    // Save assistant message to database
    const assistantMessage = await saveMessage(
      supabase,
      conversation.id,
      'assistant',
      response.content,
      {
        source: response.source,
        thinking: response.thinking,
        gatewayError: response.gatewayError,
      }
    );

    return NextResponse.json({
      id: assistantMessage.id,
      content: response.content,
      thinking: response.thinking,
      role: 'assistant',
      conversationId: conversation.id,
      source: response.source,
      error: response.error,
      gatewayError: response.gatewayError,
      userMessageId: userMessage.id,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const gatewayHealthy = await checkHealth();
  const llmConfigured = !!process.env.LLM_API_KEY;

  return NextResponse.json({
    status: gatewayHealthy || llmConfigured ? 'healthy' : 'degraded',
    gateway: gatewayHealthy ? 'connected' : 'disconnected',
    llmFallback: llmConfigured ? 'available' : 'not configured',
    timestamp: new Date().toISOString(),
  });
}
