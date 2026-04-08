import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { getConversationId, getRecentMessages } from '@/lib/db/conversations';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/conversations/messages
 * Fetch messages for the user's conversation with pagination.
 *
 * Query params:
 * - limit: number of messages to fetch (default 25, max 100)
 * - before: message ID to fetch messages before (for pagination)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const before = searchParams.get('before') || undefined;

    // Get user's conversation
    const conversationId = await getConversationId(supabase, user.id);

    if (!conversationId) {
      // No conversation yet - return empty
      return NextResponse.json({
        messages: [],
        hasMore: false,
        conversationId: null,
      });
    }

    // Fetch messages
    const { messages, hasMore } = await getRecentMessages(
      supabase,
      conversationId,
      limit,
      before
    );

    return NextResponse.json({
      messages,
      hasMore,
      conversationId,
    });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
