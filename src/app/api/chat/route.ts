import { createClient } from '@/lib/supabase/server';
import { sendMessage, checkHealth } from '@/lib/openclaw/client';
import { getOrCreateConversation, saveMessage } from '@/lib/db/conversations';
import { detectFunctionCalls, executeFunction } from '@/lib/llm/function-calling';
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

    // Try function calling first for calendar/email operations
    const functionCallResult = await detectFunctionCalls(message, user.id);

    if (functionCallResult.shouldUseFunctions && functionCallResult.functions) {
      // Execute functions and format response
      try {
        const results = await Promise.all(
          functionCallResult.functions.map(fn => executeFunction(fn, user.id))
        );

        // Extract card data from results
        const cards = results
          .filter(r => r.success && r.card)
          .map(r => r.card);

        // Generate a natural language response
        let responseText = '';
        if (functionCallResult.functions[0].name === 'list_calendar_events') {
          const events = results[0]?.data || [];
          if (events.length === 0) {
            responseText = "You don't have any events in that time range.";
          } else {
            responseText = `I found ${events.length} event${events.length !== 1 ? 's' : ''} on your calendar:`;
          }
        } else if (functionCallResult.functions[0].name === 'create_calendar_event') {
          responseText = `I've created the event "${functionCallResult.functions[0].arguments.summary}" on your calendar.`;
        }

        // Save assistant message with card metadata
        const assistantMessage = await saveMessage(
          supabase,
          conversation.id,
          'assistant',
          responseText,
          cards.length > 0 ? { cards } : undefined
        );

        return NextResponse.json({
          id: assistantMessage.id,
          content: responseText,
          cards,
          role: 'assistant',
          conversationId: conversation.id,
          userMessageId: userMessage.id,
        });
      } catch (error: any) {
        console.error('Function execution error:', error);
        // Fall through to OpenClaw on function error
      }
    }

    // If function calling provided a direct response (e.g., not connected), use it
    if (functionCallResult.response) {
      const assistantMessage = await saveMessage(
        supabase,
        conversation.id,
        'assistant',
        functionCallResult.response
      );

      return NextResponse.json({
        id: assistantMessage.id,
        content: functionCallResult.response,
        role: 'assistant',
        conversationId: conversation.id,
        userMessageId: userMessage.id,
      });
    }

    // Otherwise, send message to OpenClaw for general conversation
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email;
    const response = await sendMessage(message, user.id, user.id, userName);

    // Save assistant message to database
    const assistantMessage = await saveMessage(
      supabase,
      conversation.id,
      'assistant',
      response.content,
      {
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
