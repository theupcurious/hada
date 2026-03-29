import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { processMessage } from "@/lib/chat/process-message";
import { createAdminClient } from "@/lib/supabase/server";
import { getOrCreateConversation, saveMessage, updateMessageById } from "@/lib/db/conversations";
import type { AgentEvent, MessageMetadata, MessageSource } from "@/lib/types/database";

type BackgroundJobStatus = "queued" | "running" | "completed" | "failed" | "timeout";

type BackgroundJobRecord = {
  id: string;
  user_id: string;
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  source: MessageSource;
  request_text: string;
  status: BackgroundJobStatus;
  processing_token: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type BackgroundJobEventRecord = {
  seq: number;
  event: AgentEvent;
};

export async function enqueueBackgroundJob(options: {
  supabase: SupabaseClient;
  userId: string;
  source: MessageSource;
  message: string;
  /**
   * Optional existing IDs for regeneration — reuses rows instead of creating new ones.
   * Currently reserved for future background-job regeneration support; the API route
   * handles regeneration by calling processMessage directly and does not route through
   * this path yet.
   */
  userMessageId?: string;
  assistantMessageId?: string;
  conversationId?: string;
}): Promise<{
  jobId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  processingToken: string;
}> {
  const conversationId = options.conversationId
    ?? (await getOrCreateConversation(options.supabase, options.userId)).id;
  const jobId = crypto.randomUUID();
  const processingToken = crypto.randomUUID();

  const assistantMetadata: MessageMetadata = {
    source: options.source,
    backgroundJob: {
      id: jobId,
      status: "queued",
      pending: true,
    },
  };

  let userMessageId: string;
  let assistantMessageId: string;

  if (options.userMessageId && options.assistantMessageId) {
    // Regeneration: reuse existing message rows
    userMessageId = options.userMessageId;
    assistantMessageId = options.assistantMessageId;

    await updateMessageById(
      options.supabase,
      assistantMessageId,
      "",
      assistantMetadata,
    );
  } else {
    // Normal path: create new message rows
    const userMessage = await saveMessage(
      options.supabase,
      conversationId,
      "user",
      options.message,
      {
        source: options.source,
      },
    );
    userMessageId = userMessage.id;

    const assistantMessage = await saveMessage(
      options.supabase,
      conversationId,
      "assistant",
      "",
      assistantMetadata,
    );
    assistantMessageId = assistantMessage.id;
  }

  const { error } = await options.supabase.from("background_jobs").insert({
    id: jobId,
    user_id: options.userId,
    conversation_id: conversationId,
    user_message_id: userMessageId,
    assistant_message_id: assistantMessageId,
    source: options.source,
    request_text: options.message,
    status: "queued",
    processing_token: processingToken,
  });

  if (error) {
    throw new Error(`Failed to enqueue background job: ${error.message}`);
  }

  return {
    jobId,
    conversationId,
    userMessageId,
    assistantMessageId,
    processingToken,
  };
}

export function scheduleBackgroundJobProcessing(options: {
  requestOrigin: string;
  jobId: string;
  processingToken: string;
}): void {
  after(async () => {
    try {
      await fetch(
        `${options.requestOrigin}/api/background-jobs/${options.jobId}/run?token=${encodeURIComponent(options.processingToken)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );
    } catch (error) {
      console.error("Failed to trigger background job processing", options.jobId, error);
    }
  });
}

export async function processBackgroundJob(jobId: string, token?: string): Promise<{
  processed: boolean;
  status?: BackgroundJobStatus;
}> {
  const supabase = createAdminClient();
  const job = await claimBackgroundJob(supabase, jobId, token);

  if (!job) {
    return { processed: false };
  }

  let nextSeq = 0;
  const recordEvent = async (event: AgentEvent) => {
    nextSeq += 1;
    await appendBackgroundJobEvent(supabase, {
      jobId: job.id,
      userId: job.user_id,
      seq: nextSeq,
      event,
    });
  };

  try {
    await processMessage({
      userId: job.user_id,
      message: job.request_text,
      source: job.source,
      supabase,
      conversationId: job.conversation_id,
      userMessageId: job.user_message_id,
      assistantMessageId: job.assistant_message_id,
      backgroundJobId: job.id,
      onEvent: recordEvent,
    });

    await finalizeBackgroundJob(supabase, job.id, "completed", null);
    return { processed: true, status: "completed" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while processing background job.";
    const status: BackgroundJobStatus = /\btimed out\b/i.test(message) ? "timeout" : "failed";

    await updateMessageById(
      supabase,
      job.assistant_message_id,
      message,
      {
        source: job.source,
        gatewayError: { code: "AGENT_ERROR", message },
        backgroundJob: {
          id: job.id,
          status,
          pending: false,
        },
      },
    );

    await finalizeBackgroundJob(supabase, job.id, status, message);
    return { processed: true, status };
  }
}

export async function loadBackgroundJobForUser(options: {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  afterSeq?: number;
}): Promise<{
  job: BackgroundJobRecord;
  events: BackgroundJobEventRecord[];
  assistantMessage: {
    id: string;
    content: string;
    metadata: MessageMetadata | null;
  } | null;
}> {
  const afterSeq = options.afterSeq ?? 0;

  const [{ data: job, error: jobError }, { data: events, error: eventsError }, { data: assistantMessage, error: assistantError }] = await Promise.all([
    options.supabase
      .from("background_jobs")
      .select("*")
      .eq("id", options.jobId)
      .eq("user_id", options.userId)
      .single(),
    options.supabase
      .from("background_job_events")
      .select("seq, event")
      .eq("job_id", options.jobId)
      .eq("user_id", options.userId)
      .gt("seq", afterSeq)
      .order("seq", { ascending: true }),
    options.supabase
      .from("messages")
      .select("id, content, metadata")
      .eq("id", (
        await options.supabase
          .from("background_jobs")
          .select("assistant_message_id")
          .eq("id", options.jobId)
          .eq("user_id", options.userId)
          .single()
      ).data?.assistant_message_id || "")
      .maybeSingle(),
  ]);

  if (jobError || !job) {
    throw new Error(jobError?.message || "Background job not found");
  }

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  if (assistantError && assistantError.code !== "PGRST116") {
    throw new Error(assistantError.message);
  }

  return {
    job: job as BackgroundJobRecord,
    events: ((events || []) as Array<{ seq: number; event: AgentEvent }>).map((entry) => ({
      seq: entry.seq,
      event: entry.event,
    })),
    assistantMessage: assistantMessage
      ? {
          id: String((assistantMessage as { id?: string }).id || ""),
          content: String((assistantMessage as { content?: string }).content || ""),
          metadata: ((assistantMessage as { metadata?: MessageMetadata | null }).metadata || null),
        }
      : null,
  };
}

export async function processQueuedBackgroundJobs(limit = 3): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  let processed = 0;
  for (const row of (data || []) as Array<{ id: string }>) {
    const result = await processBackgroundJob(row.id);
    if (result.processed) {
      processed += 1;
    }
  }

  return processed;
}

async function claimBackgroundJob(
  supabase: SupabaseClient,
  jobId: string,
  token?: string,
): Promise<BackgroundJobRecord | null> {
  let query = supabase
    .from("background_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: 1,
      processing_token: null,
    })
    .eq("id", jobId)
    .eq("status", "queued");

  if (token) {
    query = query.eq("processing_token", token);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    return null;
  }

  return (data as BackgroundJobRecord) || null;
}

async function appendBackgroundJobEvent(
  supabase: SupabaseClient,
  options: {
    jobId: string;
    userId: string;
    seq: number;
    event: AgentEvent;
  },
): Promise<void> {
  const { error } = await supabase.from("background_job_events").insert({
    job_id: options.jobId,
    user_id: options.userId,
    seq: options.seq,
    event: options.event,
  });

  if (error) {
    throw new Error(`Failed to append background job event: ${error.message}`);
  }
}

async function finalizeBackgroundJob(
  supabase: SupabaseClient,
  jobId: string,
  status: BackgroundJobStatus,
  errorMessage: string | null,
): Promise<void> {
  const { data: job, error: fetchError } = await supabase
    .from("background_jobs")
    .select("assistant_message_id, source")
    .eq("id", jobId)
    .single();

  if (fetchError || !job) {
    throw new Error(fetchError?.message || "Background job not found during finalize");
  }

  const { data: messageRow } = await supabase
    .from("messages")
    .select("content, metadata")
    .eq("id", job.assistant_message_id)
    .single();

  await updateMessageById(
    supabase,
    job.assistant_message_id,
    String((messageRow as { content?: string }).content || ""),
    {
      ...((((messageRow as { metadata?: MessageMetadata | null }).metadata || null) || {}) as MessageMetadata),
      source: String((job as { source?: string }).source || "web") as MessageSource,
      backgroundJob: {
        id: jobId,
        status,
        pending: false,
      },
    },
  );

  const { error } = await supabase
    .from("background_jobs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      last_error: errorMessage,
      processing_token: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to finalize background job: ${error.message}`);
  }
}
