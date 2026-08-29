import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Conversation,
  Message,
  MessageMetadata,
  MessageRole,
} from '@/lib/types/database';

/**
 * Get the user's conversation, or create one if it doesn't exist.
 * Each user has exactly one conversation (WhatsApp/Telegram style).
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  projectId?: string | null,
): Promise<Conversation> {
  // Try to get the existing conversation for this (user, space). A null
  // projectId is the default "General" space.
  const existingQuery = supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: existing, error: fetchError } = await (projectId
    ? existingQuery.eq('project_id', projectId)
    : existingQuery.is('project_id', null)
  ).single();

  if (existing && !fetchError) {
    return existing as Conversation;
  }

  // Create new conversation
  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ user_id: userId, project_id: projectId ?? null, title: null })
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
  role: MessageRole,
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

export async function updateMessageById(
  supabase: SupabaseClient,
  messageId: string,
  content: string,
  metadata?: MessageMetadata | null,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .update({
      content,
      metadata: metadata ?? null,
    })
    .eq("id", messageId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update message: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Failed to update message: no row matched id ${messageId}`);
  }

  return data as Message;
}

/**
 * Delete a single message by ID, scoped to the given user for safety.
 */
export async function deleteMessageById(
  supabase: SupabaseClient,
  messageId: string,
  userId: string,
  projectId?: string | null,
): Promise<void> {
  // Resolve the active space's conversation first so we only delete messages
  // the user owns. Scoping by projectId is essential: without it, a non-General
  // space would resolve an arbitrary conversation and the delete would silently
  // match nothing. A null projectId is the default "General" space.
  const convQuery = supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: conv } = await (projectId
    ? convQuery.eq("project_id", projectId)
    : convQuery.is("project_id", null)
  ).maybeSingle();

  if (!conv) return; // No conversation — nothing to delete.

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("conversation_id", conv.id);

  if (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }
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
  const fetchLimit = limit * 4 + 10;
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

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

  const filtered = ((data || []) as Message[]).filter((message) => {
    const metadata = message.metadata as MessageMetadata | null;
    return metadata?.type !== 'compaction';
  });

  const hasMore = filtered.length > limit;
  const messages = hasMore ? filtered.slice(0, limit) : filtered;

  // Reverse to chronological order (oldest first)
  return {
    messages: messages.reverse(),
    hasMore,
  };
}

/**
 * Load all messages belonging to a single segment, in chronological order.
 * Scoped to the given conversation so callers can't read across users.
 * Filters out internal compaction rows, matching getRecentMessages.
 */
export async function getSegmentMessages(
  supabase: SupabaseClient,
  conversationId: string,
  segmentId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("segment_id", segmentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch segment messages: ${error.message}`);
  }

  return ((data || []) as Message[]).filter((message) => {
    const metadata = message.metadata as MessageMetadata | null;
    return metadata?.type !== "compaction";
  });
}

/**
 * Get a user's conversation ID if it exists.
 */
export async function getConversationId(
  supabase: SupabaseClient,
  userId: string,
  projectId?: string | null,
): Promise<string | null> {
  const query = supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const { data, error } = await (projectId
    ? query.eq('project_id', projectId)
    : query.is('project_id', null)
  ).single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Load all messages in a conversation for regeneration resolution.
 * Returns minimal fields (id, role, content) in chronological order.
 */
export async function getConversationMessagesForRegeneration(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Array<{ id: string; role: MessageRole; content: string }>> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load regeneration messages: ${error.message}`);
  }

  return (data || []) as Array<{ id: string; role: MessageRole; content: string }>;
}

/**
 * Patch specific fields on a message's metadata, preserving existing metadata.
 */
export async function patchMessageMetadata(
  supabase: SupabaseClient,
  messageId: string,
  patch: Partial<MessageMetadata>,
): Promise<Message> {
  const { data: existing, error: fetchError } = await supabase
    .from("messages")
    .select("content, metadata")
    .eq("id", messageId)
    .single();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message || "Message not found");
  }

  return updateMessageById(
    supabase,
    messageId,
    String(existing.content || ""),
    {
      ...(((existing.metadata || {}) as MessageMetadata)),
      ...patch,
    },
  );
}

/**
 * Global account reset for "Clear chat": delete every one of the user's
 * conversations across all Spaces (each carries its own messages via cascade)
 * and clear all web chat activity. Scoped per-Space clearing is intentionally
 * not offered here — this is the account-level action, and the activity panel
 * it feeds is itself global. Returns true when anything was deleted.
 */
export async function clearAllConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const [{ count: convCount }, { count: webRunCount, error: webRunCountError }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("source", "web"),
    ]);

  if (webRunCountError) {
    throw new Error(`Failed to inspect chat activity: ${webRunCountError.message}`);
  }

  const cleared = (convCount || 0) > 0 || (webRunCount || 0) > 0;

  // Remove activity rows tied to web chat so the welcome "Recent activity"
  // panel reflects a cleared chat state.
  const { error: runsError } = await supabase
    .from("agent_runs")
    .delete()
    .eq("user_id", userId)
    .eq("source", "web");

  if (runsError) {
    throw new Error(`Failed to clear chat activity: ${runsError.message}`);
  }

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to clear conversation: ${error.message}`);
  }

  return cleared;
}
