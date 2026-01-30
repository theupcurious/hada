import { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, Message } from '@/lib/types/database';

export interface MessageMetadata {
  thinking?: string;
  runId?: string;
  gatewayError?: { code: string; message: string };
  cards?: any[];
  confirmation?: {
    pending?: boolean;
    function?: {
      name?: string;
      arguments?: Record<string, any>;
    };
    confirmationData?: any;
    created_at?: string;
    resolved_at?: string;
    cancelled?: boolean;
  };
}

/**
 * Get the user's conversation, or create one if it doesn't exist.
 * Each user has exactly one conversation (WhatsApp/Telegram style).
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string
): Promise<Conversation> {
  // Try to get existing conversation
  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing && !fetchError) {
    return existing as Conversation;
  }

  // Create new conversation
  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title: null })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create conversation: ${createError.message}`);
  }

  return created as Conversation;
}

/**
 * Save a message to the conversation.
 */
export async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: MessageMetadata
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata: metadata || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Get recent messages from a conversation with pagination.
 * Returns messages in chronological order (oldest first).
 * Use `before` to paginate backwards (load older messages).
 */
export async function getRecentMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = 25,
  before?: string
): Promise<{ messages: Message[]; hasMore: boolean }> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there are more

  if (before) {
    // Get the timestamp of the "before" message to paginate
    const { data: beforeMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', before)
      .single();

    if (beforeMsg) {
      query = query.lt('created_at', beforeMsg.created_at);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  const messages = (data || []) as Message[];
  const hasMore = messages.length > limit;

  // Remove the extra message we fetched for pagination check
  if (hasMore) {
    messages.pop();
  }

  // Reverse to chronological order (oldest first)
  return {
    messages: messages.reverse(),
    hasMore,
  };
}

/**
 * Get a user's conversation ID if it exists.
 */
export async function getConversationId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}
