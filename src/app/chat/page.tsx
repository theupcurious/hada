"use client";

export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { useHealthStatus } from "@/lib/hooks/use-health-status";
import { type TraceEvent, type ThinkingEvent } from "@/components/chat/agent-trace";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ChatMessageRow } from "@/components/chat/chat-message-row";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { SaveToDocModal } from "@/components/chat/save-to-doc-modal";
import { DocAttachPicker, AttachedDocChips, type AttachedDoc } from "@/components/chat/doc-attach-picker";
import type { TaskPlan } from "@/lib/types/database";
import type { ChatCard } from "@/lib/types/cards";
import type { StreamingSegment } from "@/components/chat/streaming-message";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback, type MutableRefObject } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  backgroundJob?: {
    id: string;
    status: "queued" | "running" | "completed" | "failed" | "timeout";
    pending: boolean;
  };
  thinking?: string;
  cards?: ChatCard[];
  traceEvents?: TraceEvent[];
  thinkingEvents?: ThinkingEvent[];
  plan?: TaskPlan;
  activeStepId?: string;
  confirmation?: {
    pending: boolean;
    function?: {
      name: string;
      arguments: Record<string, unknown>;
    };
  };
  followUpSuggestions?: string[];
  feedback?: {
    value?: "up" | "down";
    updated_at?: string;
  };
  streamSegments?: StreamingSegment[];
  isError?: boolean;
  isStreaming?: boolean;
  created_at: string;
}

interface ApiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: {
    thinking?: string;
    cards?: ChatCard[];
    backgroundJob?: {
      id?: string;
      status?: "queued" | "running" | "completed" | "failed" | "timeout";
      pending?: boolean;
    };
    gatewayError?: { code: string; message: string };
    confirmation?: {
      pending?: boolean;
      function?: {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    };
    followUpSuggestions?: unknown;
    feedback?: {
      value?: unknown;
      updated_at?: unknown;
    };
  } | null;
  created_at: string;
}

interface BackgroundJobPollResponse {
  job?: {
    id: string;
    status: "queued" | "running" | "completed" | "failed" | "timeout";
    last_error?: string | null;
  };
  events?: Array<{
    seq: number;
    event: Record<string, unknown>;
  }>;
  assistantMessage?: {
    id: string;
    content: string;
    metadata: {
      backgroundJob?: {
        id?: string;
        status?: "queued" | "running" | "completed" | "failed" | "timeout";
        pending?: boolean;
      };
      cards?: ChatCard[];
      followUpSuggestions?: unknown;
      gatewayError?: { code?: string; message?: string };
    } | null;
  } | null;
  error?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string; id?: string } | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [greetingText, setGreetingText] = useState("Hello");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [recentRuns, setRecentRuns] = useState<Array<{ id: string; input_preview: string | null; source: string; status: string; started_at: string }>>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [artifactContent, setArtifactContent] = useState<{ title: string; content: string } | null>(null);
  const [saveModalContent, setSaveModalContent] = useState<string | null>(null);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventOrderRef = useRef(0);
  const backgroundJobPollersRef = useRef(new Map<string, number>());
  const backgroundJobCursorRef = useRef(new Map<string, number>());
  const router = useRouter();
  const supabase = createClient();
  const { status: connectionStatus } = useHealthStatus(30000); // Poll every 30s

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    endOfMessagesRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const scrollToTop = () => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = 0;
    }
  };

  const apiMessageToMessage = (msg: ApiMessage): Message => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    thinking: msg.metadata?.thinking,
    cards: msg.metadata?.cards,
    confirmation: msg.metadata?.confirmation?.pending
      ? {
          pending: true,
          function: msg.metadata?.confirmation?.function
            ? {
                name: msg.metadata.confirmation.function.name || "",
                arguments: msg.metadata.confirmation.function.arguments || {},
              }
            : undefined,
        }
      : undefined,
    backgroundJob: msg.metadata?.backgroundJob?.id
      ? {
          id: msg.metadata.backgroundJob.id,
          status: msg.metadata.backgroundJob.status || "queued",
          pending: msg.metadata.backgroundJob.pending !== false,
        }
      : undefined,
    followUpSuggestions: Array.isArray(msg.metadata?.followUpSuggestions)
      ? msg.metadata.followUpSuggestions.filter((value): value is string => typeof value === "string")
      : undefined,
    feedback:
      msg.metadata?.feedback && typeof msg.metadata.feedback === "object"
        ? {
            value:
              msg.metadata.feedback.value === "up" || msg.metadata.feedback.value === "down"
                ? msg.metadata.feedback.value
                : undefined,
            updated_at:
              typeof msg.metadata.feedback.updated_at === "string"
                ? msg.metadata.feedback.updated_at
                : undefined,
          }
        : undefined,
    isError: !!msg.metadata?.gatewayError,
    created_at: msg.created_at,
  });

  const updateMessage = useCallback((messageId: string, updater: (message: Message) => Message) => {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? updater(message) : message)));
  }, []);

  const stopBackgroundJobPolling = useCallback((jobId: string) => {
    const poller = backgroundJobPollersRef.current.get(jobId);
    if (poller != null) {
      window.clearInterval(poller);
      backgroundJobPollersRef.current.delete(jobId);
    }
  }, []);

  const applyAgentEventToMessage = useCallback((assistantMessageId: string, event: Record<string, unknown>) => {
    if (event.type === "text_delta" && typeof event.content === "string") {
      setIsThinking(false);
      const deltaText = event.content;
      const segmentId = `${assistantMessageId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        content: message.content + deltaText,
        streamSegments: [
          ...(message.streamSegments || []),
          { id: segmentId, text: deltaText },
        ],
      }));
      return;
    }

    if (event.type === "tool_call") {
      setIsThinking(true);
      const order = nextEventOrder(eventOrderRef);
      const callId = typeof event.callId === "string" ? event.callId : `call_${Date.now()}`;
      const name = typeof event.name === "string" ? event.name : "unknown";
      const args = (event.args && typeof event.args === "object") ? event.args as Record<string, unknown> : {};
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        traceEvents: (() => {
          const traces = message.traceEvents || [];
          const existingIndex = traces.findIndex((trace) => trace.callId === callId);
          const nextTrace = {
            callId,
            name,
            args,
            agentName: typeof event.agentName === "string" ? event.agentName : undefined,
            order,
            status: "running" as const,
          };

          if (existingIndex >= 0) {
            return traces.map((trace, index) =>
              index === existingIndex
                ? {
                    ...trace,
                    ...nextTrace,
                    order: trace.order ?? nextTrace.order,
                  }
                : trace,
            );
          }

          return [...traces, nextTrace];
        })(),
      }));
      return;
    }

    if (event.type === "tool_result") {
      const callId = typeof event.callId === "string" ? event.callId : "";
      const result = typeof event.result === "string" ? event.result : "";
      const durationMs = typeof event.durationMs === "number" ? event.durationMs : undefined;
      const truncated = !!event.truncated;
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        traceEvents: (message.traceEvents || []).map((trace) =>
          trace.callId === callId
            ? {
                ...trace,
                result,
                durationMs,
                truncated,
                agentName:
                  typeof event.agentName === "string" ? event.agentName : trace.agentName,
                status: isToolErrorResult(result) ? "error" as const : "done" as const,
              }
            : trace,
        ),
      }));
      return;
    }

    if (event.type === "thinking" && typeof event.content === "string") {
      const order = nextEventOrder(eventOrderRef);
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        thinkingEvents: (() => {
          const thinkingEvents = message.thinkingEvents || [];
          const lastEvent = thinkingEvents[thinkingEvents.length - 1];
          const nextThinking = {
            content: event.content as string,
            agentName: typeof event.agentName === "string" ? event.agentName : undefined,
            order,
          };
          const normalizeThinking = (value: string) => value.replace(/\s+/g, " ").trim();

          if (
            lastEvent &&
            normalizeThinking(lastEvent.content) === normalizeThinking(nextThinking.content) &&
            lastEvent.agentName === nextThinking.agentName
          ) {
            return thinkingEvents;
          }

          if (lastEvent && lastEvent.agentName === nextThinking.agentName) {
            return [
              ...thinkingEvents.slice(0, -1),
              {
                ...lastEvent,
                content: nextThinking.content,
              },
            ];
          }

          return [...thinkingEvents, nextThinking];
        })(),
      }));
      return;
    }

    if (event.type === "delegation_started") {
      const agentName = typeof event.agentName === "string" ? event.agentName : "subagent";
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        traceEvents: (() => {
          const traces = [...(message.traceEvents || [])];
          for (let i = traces.length - 1; i >= 0; i -= 1) {
            const trace = traces[i];
            if (
              trace.name === "delegate_task" &&
              trace.status === "running" &&
              !trace.agentName
            ) {
              traces[i] = { ...trace, agentName };
              return traces;
            }
          }

          return [
            ...traces,
            {
              callId: `delegation-${agentName}-${Date.now()}`,
              name: "delegate_task",
              args: {
                agent: agentName,
                task: typeof event.task === "string" ? event.task : "",
              },
              agentName,
              order: nextEventOrder(eventOrderRef),
              status: "running" as const,
            },
          ];
        })(),
      }));
      return;
    }

    if (event.type === "delegation_completed") {
      return;
    }

    if (event.type === "plan_created" && isTaskPlan(event.plan)) {
      const plan = event.plan;
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        plan,
        activeStepId: undefined,
      }));
      return;
    }

    if (event.type === "step_started") {
      const stepId = typeof event.stepId === "string" ? event.stepId : "";
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        activeStepId: stepId,
        plan: message.plan
          ? {
              ...message.plan,
              steps: message.plan.steps.map((step) => ({
                ...step,
                status: step.id === stepId
                  ? "running"
                  : step.status === "running"
                  ? "pending"
                  : step.status,
              })),
            }
          : message.plan,
      }));
      return;
    }

    if (event.type === "step_completed") {
      const stepId = typeof event.stepId === "string" ? event.stepId : "";
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        activeStepId: message.activeStepId === stepId ? undefined : message.activeStepId,
        plan: message.plan
          ? {
              ...message.plan,
              steps: message.plan.steps.map((step) =>
                step.id === stepId ? { ...step, status: "done" as const } : step,
              ),
            }
          : message.plan,
      }));
      return;
    }

    if (event.type === "step_failed") {
      const stepId = typeof event.stepId === "string" ? event.stepId : "";
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        activeStepId: message.activeStepId === stepId ? undefined : message.activeStepId,
        plan: message.plan
          ? {
              ...message.plan,
              steps: message.plan.steps.map((step) =>
                step.id === stepId ? { ...step, status: "failed" as const } : step,
              ),
            }
          : message.plan,
      }));
      return;
    }

    if (event.type === "error") {
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        content: String(event.message ?? "Sorry, I encountered an error."),
        isStreaming: false,
        isError: true,
      }));
    }
  }, [updateMessage]);

  const pollBackgroundJob = useCallback(async (jobId: string, assistantMessageId: string) => {
    const cursor = backgroundJobCursorRef.current.get(jobId) || 0;
    const response = await fetch(`/api/background-jobs/${jobId}?after=${cursor}`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as BackgroundJobPollResponse;

    if (!response.ok || !data.job) {
      throw new Error(data.error || "Failed to load background job state.");
    }

    for (const entry of data.events || []) {
      backgroundJobCursorRef.current.set(
        jobId,
        Math.max(backgroundJobCursorRef.current.get(jobId) || 0, entry.seq),
      );
      applyAgentEventToMessage(assistantMessageId, entry.event);
    }

    updateMessage(assistantMessageId, (message) => ({
      ...message,
      backgroundJob: {
        id: jobId,
        status: data.job!.status,
        pending: data.job!.status === "queued" || data.job!.status === "running",
      },
      isStreaming: data.job!.status === "queued" || data.job!.status === "running",
    }));

    if (data.job.status === "completed" || data.job.status === "failed" || data.job.status === "timeout") {
      stopBackgroundJobPolling(jobId);
      setIsLoading(false);
      setIsThinking(false);

      if (data.assistantMessage) {
        updateMessage(assistantMessageId, (message) => ({
          ...message,
          id: data.assistantMessage?.id || message.id,
          content: data.assistantMessage?.content || message.content,
          cards: Array.isArray(data.assistantMessage?.metadata?.cards)
            ? (data.assistantMessage.metadata.cards as ChatCard[])
            : message.cards,
          followUpSuggestions: Array.isArray(data.assistantMessage?.metadata?.followUpSuggestions)
            ? (data.assistantMessage.metadata.followUpSuggestions as unknown[]).filter(
                (v): v is string => typeof v === "string",
              )
            : message.followUpSuggestions,
          backgroundJob: {
            id: jobId,
            status: data.job!.status,
            pending: false,
          },
          isStreaming: false,
          isError:
            data.job!.status !== "completed" ||
            !!data.assistantMessage?.metadata?.gatewayError,
        }));
      }
    }
  }, [applyAgentEventToMessage, stopBackgroundJobPolling, updateMessage]);

  const ensureBackgroundJobPolling = useCallback((jobId: string, assistantMessageId: string) => {
    if (backgroundJobPollersRef.current.has(jobId)) {
      return;
    }

    void pollBackgroundJob(jobId, assistantMessageId).catch((error) => {
      console.error("Background job polling failed:", error);
    });

    const timer = window.setInterval(() => {
      void pollBackgroundJob(jobId, assistantMessageId).catch((error) => {
        console.error("Background job polling failed:", error);
      });
    }, 2500);

    backgroundJobPollersRef.current.set(jobId, timer);
  }, [pollBackgroundJob]);

  const loadHistory = useCallback(async (before?: string) => {
    try {
      const url = new URL("/api/conversations/messages", window.location.origin);
      url.searchParams.set("limit", "25");
      if (before) {
        url.searchParams.set("before", before);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to load messages");
      }

      const data = await response.json();
      const loadedMessages: Message[] = data.messages.map(apiMessageToMessage);

      if (before) {
        // Prepend older messages
        setMessages((prev) => [...loadedMessages, ...prev]);
      } else {
        // Initial load
        setMessages(loadedMessages);
      }

      setHasMoreHistory(data.hasMore);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }, []);

  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMore || !hasMoreHistory || messages.length === 0) return;

    setIsLoadingMore(true);
    const oldestMessage = messages[0];

    // Store scroll position before loading
    const scrollArea = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    const scrollHeightBefore = scrollArea?.scrollHeight || 0;

    await loadHistory(oldestMessage.id);

    // Restore scroll position after messages are prepended
    requestAnimationFrame(() => {
      if (scrollArea) {
        const scrollHeightAfter = scrollArea.scrollHeight;
        scrollArea.scrollTop = scrollHeightAfter - scrollHeightBefore;
      }
    });

    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreHistory, messages, loadHistory]);

  const autosizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`; // cap growth to keep UX stable
  };

  useEffect(() => {
    const initialize = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/auth/login");
        return;
      }

      // Load full user profile from DB
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, name, email, settings")
        .eq("id", authUser.id)
        .single();

      const dbName = (dbUser as { name?: string | null } | null)?.name;
      const displayName = dbName || authUser.user_metadata?.name || null;
      const settings = (dbUser as { settings?: Record<string, unknown> } | null)?.settings || {};

      setUser({ email: authUser.email, name: displayName ?? undefined, id: authUser.id });

      // Auto-detect and silently save timezone if not set
      if (!settings.timezone) {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTimezone) {
          await supabase
            .from("users")
            .update({ settings: { ...settings, timezone: detectedTimezone } })
            .eq("id", authUser.id);
        }
      }

      // Show profile setup card for users with no name who haven't dismissed it
      const dismissed = typeof window !== "undefined"
        ? localStorage.getItem("hada_profile_setup_dismissed")
        : null;
      if (!displayName && !dismissed) {
        setShowProfileSetup(true);
      }

      // Load message history + recent activity in parallel
      await Promise.all([
        loadHistory(),
        fetch("/api/dashboard/activity?limit=3", { cache: "no-store" })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => {
            if (!d) return;
            const runs = Array.isArray(d?.runs) ? d.runs : [];
            setRecentRuns(runs);
          })
          .catch(() => null),
      ]);
      setIsLoadingHistory(false);
    };
    initialize();
  }, [router, supabase, loadHistory]);

  const handleProfileSave = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    const name = profileName.trim();
    if (name) {
      await supabase.from("users").update({ name }).eq("id", user.id);
      setUser((prev) => prev ? { ...prev, name } : prev);
    }
    localStorage.setItem("hada_profile_setup_dismissed", "1");
    setShowProfileSetup(false);
    setSavingProfile(false);
  };

  const handleProfileSkip = () => {
    localStorage.setItem("hada_profile_setup_dismissed", "1");
    setShowProfileSetup(false);
  };

  useEffect(() => {
    if (!showConversation) {
      requestAnimationFrame(scrollToTop);
      return;
    }

    // Ensure the newest message (or loader) is visible.
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [messages, isLoading, isThinking, showConversation]);

  useEffect(() => {
    autosizeTextarea();
  }, [input]);

  useEffect(() => {
    for (const message of messages) {
      if (
        message.role === "assistant" &&
        message.backgroundJob?.id &&
        message.backgroundJob.pending
      ) {
        ensureBackgroundJobPolling(message.backgroundJob.id, message.id);
      } else if (message.backgroundJob?.id && !message.backgroundJob.pending) {
        stopBackgroundJobPolling(message.backgroundJob.id);
      }
    }
  }, [messages, ensureBackgroundJobPolling, stopBackgroundJobPolling]);

  useEffect(() => {
    const pollers = backgroundJobPollersRef.current;

    return () => {
      for (const poller of pollers.values()) {
        window.clearInterval(poller);
      }
      pollers.clear();
    };
  }, []);

  /**
   * Reads an SSE response stream and applies agent events to a given assistant message.
   * For sendMessage, `assistantMessageId` starts as a temp ID and is updated to the real
   * ID once a `complete` or `background_job` event arrives. For regeneration, the caller
   * passes the existing real message ID and the ID update logic still applies if the server
   * returns a fresh ID in the event.
   *
   * @param response - The fetch Response from /api/chat
   * @param assistantMessageId - The current message ID to target (may be a temp ID)
   * @param userMessageId - The current user message ID (may be a temp ID, or null for regen)
   */
  const processChatStream = useCallback(async (
    response: Response,
    assistantMessageId: string,
    userMessageId: string | null,
  ) => {
    if (!response.ok || !response.body) {
      const errData = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(String(errData.error ?? `Request failed: ${response.status}`));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedTerminalEvent = false;
    // Track the current assistant message ID in case it changes from temp → real
    let currentAssistantId = assistantMessageId;
    eventOrderRef.current = 0;

    const processStreamEvent = (event: Record<string, unknown>) => {
      if (event.type === "complete") {
        receivedTerminalEvent = true;
        const realAssistantId = String(event.id ?? currentAssistantId);
        const terminalResponse =
          typeof event.response === "string" ? event.response : null;
        setMessages((prev) =>
          prev.map((msg) => {
            if (userMessageId && msg.id === userMessageId) {
              return { ...msg, id: String(event.userMessageId ?? userMessageId) };
            }
            if (msg.id === currentAssistantId) {
              return {
                ...msg,
                id: realAssistantId,
                content: terminalResponse ?? msg.content,
                cards: Array.isArray(event.cards) ? (event.cards as ChatCard[]) : msg.cards,
                followUpSuggestions: Array.isArray(event.followUpSuggestions)
                  ? (event.followUpSuggestions as string[]).filter((v): v is string => typeof v === "string")
                  : msg.followUpSuggestions,
                isStreaming: false,
                isError: !!event.isError,
                backgroundJob: undefined,
                streamSegments: undefined,
              };
            }
            return msg;
          }),
        );
        currentAssistantId = realAssistantId;
      } else if (event.type === "message_saved") {
        const realAssistantId = String(event.id ?? currentAssistantId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantId
              ? {
                  ...msg,
                  id: realAssistantId,
                  isStreaming: false,
                }
              : msg,
          ),
        );
        currentAssistantId = realAssistantId;
      } else if (event.type === "follow_up_suggestions") {
        const suggestions = Array.isArray(event.suggestions) ? (event.suggestions as string[]) : [];
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantId
              ? {
                  ...msg,
                  followUpSuggestions: suggestions,
                }
              : msg,
          ),
        );
      } else if (event.type === "error") {
        receivedTerminalEvent = true;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantId
              ? {
                  ...msg,
                  content: String(event.message ?? "Sorry, I encountered an error."),
                  isStreaming: false,
                  isError: true,
                  streamSegments: undefined,
                }
              : msg,
          ),
        );
      } else if (event.type === "background_job") {
        receivedTerminalEvent = true;
        const realAssistantId = String(event.assistantMessageId ?? currentAssistantId);
        const jobId = String(event.jobId ?? "");

        setMessages((prev) =>
          prev.map((msg) => {
            if (userMessageId && msg.id === userMessageId) {
              return { ...msg, id: String(event.userMessageId ?? userMessageId) };
            }
            if (msg.id === currentAssistantId) {
              return {
                ...msg,
                id: realAssistantId,
                backgroundJob: jobId
                  ? {
                      id: jobId,
                      status: "queued" as const,
                      pending: true,
                    }
                  : undefined,
                isStreaming: true,
              };
            }
            return msg;
          }),
        );
        currentAssistantId = realAssistantId;

        if (jobId) {
          ensureBackgroundJobPolling(jobId, realAssistantId);
        }
      } else {
        applyAgentEventToMessage(currentAssistantId, event);
      }
    };

    const processBufferedLines = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line.slice(6)) as Record<string, unknown>;
        } catch {
          continue;
        }

        processStreamEvent(event);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        processBufferedLines(decoder.decode());
        if (buffer.startsWith("data: ")) {
          try {
            processStreamEvent(JSON.parse(buffer.slice(6)) as Record<string, unknown>);
          } catch {
            // Ignore malformed trailing data.
          }
        }
        break;
      }

      processBufferedLines(decoder.decode(value, { stream: true }));
    }

    if (!receivedTerminalEvent) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentAssistantId
            ? {
                ...msg,
                content: msg.content.trim()
                  ? `${msg.content}\n\nResponse interrupted before completion. Please try again.`
                  : "Response interrupted before completion. Please try again.",
                isStreaming: false,
                isError: true,
                streamSegments: undefined,
              }
            : msg,
        ),
      );
    }

    return currentAssistantId;
  }, [applyAgentEventToMessage, ensureBackgroundJobPolling]);

  const handleSaveToDoc = (_messageId: string, content: string) => {
    setSaveModalContent(content);
  };

  const handleOpenArtifact = (_messageId: string, content: string) => {
    const titleMatch = content.match(/^#{1,3}\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : "Response";
    setArtifactContent({ title, content });
  };

  const handleAttachDoc = (doc: AttachedDoc) => {
    setAttachedDocs((prev) => [...prev, doc]);
  };

  const handleDetachDoc = (docId: string) => {
    setAttachedDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  const sendMessage = async (overrideMessage?: string) => {
    const messageText = overrideMessage ?? input;
    if (!messageText.trim() || isLoading) return;
    setShowConversation(true);

    // Build message with attached doc context prepended
    const docsToSend = attachedDocs;
    let fullMessage = messageText.trim();
    if (docsToSend.length > 0) {
      const context = docsToSend
        .map((d) => `[Attached document: ${d.title}]\n${d.content}`)
        .join("\n\n");
      fullMessage = `${context}\n\n---\n\n${fullMessage}`;
    }

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: "user" as const,
        content: messageText.trim(),
        created_at: new Date().toISOString(),
      },
      {
        id: tempAssistantId,
        role: "assistant" as const,
        content: "",
        isStreaming: true,
        created_at: new Date().toISOString(),
      },
    ]);
    if (!overrideMessage) setInput("");
    setAttachedDocs([]);
    setIsLoading(true);
    setIsThinking(true);

    let resolvedAssistantId = tempAssistantId;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: fullMessage }),
      });

      resolvedAssistantId = await processChatStream(response, tempAssistantId, tempUserId);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === resolvedAssistantId
            ? {
                ...msg,
                content: error instanceof Error
                  ? error.message
                  : "Sorry, I'm having trouble connecting. Please try again.",
                isStreaming: false,
                isError: true,
                streamSegments: undefined,
              }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleQuickReply = (text: string) => {
    void sendMessage(text);
    requestAnimationFrame(() => {
      autosizeTextarea();
      scrollToBottom();
    });
  };

  const handleCopyMessage = async (_messageId: string, content: string) => {
    await navigator.clipboard.writeText(content);
  };

  const handleRegenerateMessage = async (assistantMessageId: string) => {
    if (isLoading) return;

    // Reset the existing assistant message to a clean streaming state
    updateMessage(assistantMessageId, (message) => ({
      ...message,
      isStreaming: true,
      isError: false,
      followUpSuggestions: undefined,
      feedback: undefined,
      traceEvents: [],
      thinkingEvents: [],
      plan: undefined,
      activeStepId: undefined,
      content: "",
      streamSegments: [],
    }));

    setIsLoading(true);
    setIsThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateAssistantMessageId: assistantMessageId }),
      });

      // No user message ID to update for regeneration — pass null
      await processChatStream(response, assistantMessageId, null);
    } catch (error) {
      console.error("Regenerate error:", error);
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        content: error instanceof Error
          ? error.message
          : "Sorry, I'm having trouble connecting. Please try again.",
        isStreaming: false,
        isError: true,
        streamSegments: undefined,
      }));
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleMessageFeedback = async (assistantMessageId: string, value: "up" | "down") => {
    // Optimistic update
    updateMessage(assistantMessageId, (message) => ({
      ...message,
      feedback: { value, updated_at: new Date().toISOString() },
    }));
    try {
      const response = await fetch(`/api/messages/${assistantMessageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      // Revert optimistic update on error
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        feedback: message.feedback?.value === value ? undefined : message.feedback,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage();
    requestAnimationFrame(() => {
      autosizeTextarea();
      scrollToBottom();
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreetingText("Good morning");
    } else if (hour < 18) {
      setGreetingText("Good afternoon");
    } else {
      setGreetingText("Good evening");
    }
  }, []);

  const starterPrompts = [
    {
      title: "Today's briefing",
      subtitle: "Top stories in tech",
      icon: "☀️",
      prompt:
        "Give me today's tech briefing. Search for the most important tech and AI news from today, read the top articles, and summarize the 5 most important stories with key takeaways. Keep it concise and scannable.",
    },
    {
      title: "Research a company",
      subtitle: "Competitive intel memo",
      icon: "🔍",
      prompt:
        "I'd like a competitive intel report on a company. Ask me which company I'm interested in, then research it thoroughly — recent funding rounds, product launches, key executive hires, market positioning, and anything notable. Write it up as a structured memo.",
    },
    {
      title: "Plan a trip",
      subtitle: "Flights, stays & itinerary",
      icon: "✈️",
      prompt:
        "Help me plan an amazing trip. Ask me where I want to go and when, then research the best flight options, top-rated hotels, must-see attractions, best restaurants, and local tips. Put it all together into a day-by-day itinerary I can actually follow.",
    },
    {
      title: "Prep me for a meeting",
      subtitle: "Talking points & context",
      icon: "🎯",
      prompt:
        "Help me prepare for an upcoming meeting. Ask me what the meeting is about and who I'm meeting with, then research the relevant topics, industry trends, and any recent news. Give me structured talking points, smart questions to ask, and key data points I can reference.",
    },
  ];

  const shouldShowLanding = !showConversation && !isLoading;
  const hasLastChat = messages.length > 0 || recentRuns.length > 0;

  const handleContinueLastChat = async () => {
    if (!messages.length) {
      await loadHistory();
    }
    setShowConversation(true);
  };

  const inputForm = (
    <form onSubmit={handleSubmit} className="w-full flex flex-col min-w-0">
      <div className="glass w-full min-w-0 max-w-full rounded-2xl overflow-hidden">
        {/* Attached doc chips */}
        <AttachedDocChips attachedDocs={attachedDocs} onDetach={handleDetachDoc} />
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (e.shiftKey) return; // newline
            if ((e.nativeEvent as unknown as { isComposing?: boolean })?.isComposing) return;
            e.preventDefault();
            void sendMessage();
          }}
          placeholder="Message Hada..."
          rows={1}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 outline-none placeholder:text-zinc-400 disabled:opacity-60"
          disabled={isLoading}
        />
        {/* Bottom bar: attach + send */}
        <div className="flex items-center gap-1 px-2 pb-2">
          <DocAttachPicker
            attachedDocs={attachedDocs}
            onAttach={handleAttachDoc}
            onDetach={handleDetachDoc}
          />
          <div className="flex-1" />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="sm"
            className="rounded-xl gradient-brand text-white border-0 shadow-md shadow-teal-500/20 disabled:opacity-40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </Button>
        </div>
      </div>
      <p className="mt-2 hidden text-center text-xs text-zinc-400 sm:block">
        Enter to send, Shift+Enter for a new line. Hada can make mistakes — verify important information.
      </p>
    </form>
  );

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}

      <header className="border-b border-zinc-200/80 bg-white/80 px-3 py-3 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/80 sm:px-4">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand shadow-md shadow-teal-500/20">
              <span className="text-sm font-bold text-white">H</span>
            </div>
            <span className="truncate font-semibold">Hada</span>
            <Link
              href="/settings"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/70 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-600 dark:border-zinc-800/70 dark:hover:text-zinc-300 sm:text-xs"
              title={`Status: ${connectionStatus}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500"
                    : connectionStatus === "degraded"
                    ? "bg-yellow-500"
                    : connectionStatus === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span className="hidden sm:inline">
                {connectionStatus === "connected" && "Online"}
                {connectionStatus === "degraded" && "Fallback"}
                {connectionStatus === "connecting" && "Connecting"}
                {connectionStatus === "disconnected" && "Offline"}
              </span>
            </Link>
          </div>
          <div className="flex items-center justify-end gap-1 sm:gap-1.5">
            <span className="hidden text-sm text-muted-foreground xl:block">{user?.email}</span>
            <ThemeToggle />

            <Link href="/docs" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="Open docs">
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/docs" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="px-2.5">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Docs
              </Button>
            </Link>

            <Link href="/settings" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="Open settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/settings" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="px-2.5">
                <Settings2 className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="sm" className="hidden px-2.5 sm:inline-flex" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className={`flex min-w-0 h-full w-full flex-col ${artifactContent ? "md:max-w-none md:px-3 sm:px-3" : "max-w-4xl mx-auto px-3 sm:px-4 md:px-6"}`}>

          {/* Messages Area */}
          <div className="flex-1 min-h-0 py-4">
            <ScrollArea
              className="h-full"
              ref={scrollAreaRef}
              onScrollCapture={(e) => {
                const target = e.target as HTMLElement;
                // Load more when scrolled near top (within 100px)
                if (target.scrollTop < 100 && hasMoreHistory && !isLoadingMore) {
                  loadMoreHistory();
                }
              }}
            >
              <div className="space-y-6 pb-6 pr-3 sm:pr-4 min-w-0 w-full">
                {isLoadingMore && (
                  <div className="flex justify-center py-2">
                    <span className="text-sm text-zinc-400">Loading earlier messages...</span>
                  </div>
                )}
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <span className="text-sm text-zinc-400">Loading...</span>
                  </div>
                ) : shouldShowLanding ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex min-h-full w-full min-w-0 flex-col items-center justify-start overflow-x-hidden px-4 pb-6 pt-4 text-center sm:min-h-[60vh] sm:justify-center sm:px-4"
                  >
                    <div className="relative mb-5 hidden sm:block sm:mb-6">
                      <div className="absolute inset-0 -m-3 rounded-3xl bg-gradient-to-br from-teal-500/20 via-cyan-500/15 to-teal-400/20 blur-xl" style={{ animation: "glow-pulse 3s ease-in-out infinite" }} />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-teal-500/25">
                        <span className="text-2xl font-bold text-white">H</span>
                      </div>
                    </div>
                    <h1 className="w-full max-w-full text-center break-words text-2xl font-semibold sm:text-3xl">
                      <span className="gradient-text">{greetingText}</span>, {user?.name || "there"}
                    </h1>
                    <p className="mt-2 w-full max-w-md text-sm text-zinc-500 sm:text-lg">What can I help you with today?</p>

                    <div className="mt-5 w-full max-w-2xl sm:hidden">
                      {inputForm}
                    </div>

                    {showProfileSetup && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="mt-5 w-full max-w-2xl rounded-2xl border border-teal-200/60 bg-teal-50/60 p-4 text-left shadow-sm backdrop-blur-sm dark:border-teal-900/40 dark:bg-teal-950/20 sm:mt-6"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Quick setup</p>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Help Hada personalise your experience.</p>
                          </div>
                          <button
                            onClick={handleProfileSkip}
                            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          >
                            Skip
                          </button>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            placeholder="What should I call you?"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleProfileSave(); }}
                            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-teal-600 dark:focus:ring-teal-600"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => void handleProfileSave()}
                            disabled={savingProfile}
                            className="shrink-0"
                          >
                            {savingProfile ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    <div className="mt-5 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:mt-8 sm:grid-cols-2 sm:gap-3">
                      {starterPrompts.map((shortcut) => (
                        <button
                          key={shortcut.title}
                          onClick={() => void sendMessage(shortcut.prompt)}
                          className="glass group min-w-0 rounded-xl p-3 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-teal-500/5 sm:p-4"
                        >
                          <div className="flex items-start gap-2.5 sm:gap-3">
                            <span className="mt-0.5 text-base leading-none sm:text-lg">{shortcut.icon}</span>
                            <div>
                              <p className="text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100">
                                {shortcut.title}
                              </p>
                              <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 sm:text-xs">
                                {shortcut.subtitle}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {hasLastChat ? (
                      <div className="mt-5 w-full max-w-2xl sm:hidden">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => void handleContinueLastChat()}
                        >
                          Continue last chat
                        </Button>
                      </div>
                    ) : null}

                    {recentRuns.length > 0 ? (
                      <div className="mt-5 hidden w-full max-w-2xl rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50 sm:mt-6 sm:block">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Recent activity</p>
                          {hasLastChat && (
                            <Button size="sm" variant="outline" onClick={() => void handleContinueLastChat()}>
                              Open chat
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {recentRuns.map((run) => (
                            <div key={run.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950/60">
                              <p className="min-w-0 flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300">
                                {run.input_preview ?? "Task ran"}
                              </p>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${run.status === "completed" ? "bg-green-500" : run.status === "running" ? "bg-yellow-500" : "bg-red-500"}`} />
                                <span className="text-[10px] text-zinc-400">
                                  {new Date(run.started_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : messages.length > 0 ? (
                      <div className="mt-5 hidden w-full max-w-2xl rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50 sm:mt-6 sm:block">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <p className="min-w-0 flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Continue where you left off
                          </p>
                          <Button size="sm" variant="outline" onClick={() => void handleContinueLastChat()}>
                            Open chat
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-8 hidden w-full max-w-2xl sm:block">
                      {inputForm}
                    </div>
                  </motion.div>
                ) : (
                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="min-w-0"
                      >
                        <ChatMessageRow
                          message={message}
                          userName={user?.name}
                          isLoading={isLoading}
                          onQuickReply={handleQuickReply}
                          onCopy={handleCopyMessage}
                          onRegenerate={handleRegenerateMessage}
                          onFeedback={handleMessageFeedback}
                          onSaveToDoc={handleSaveToDoc}
                          onOpenArtifact={handleOpenArtifact}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={endOfMessagesRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input Area - Fixed at bottom when there are messages */}
          {showConversation && messages.length > 0 && (
            <div className="shrink-0 border-t border-border/50 bg-background/80 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur-md">
              {inputForm}
            </div>
          )}
        </div>

        {/* Artifact Panel */}
        <AnimatePresence>
          {artifactContent && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "42%" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="hidden md:flex flex-col shrink-0 overflow-hidden"
            >
              <ArtifactPanel
                artifact={{ title: artifactContent.title, content: artifactContent.content }}
                onClose={() => setArtifactContent(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save to Doc modal */}
      {saveModalContent !== null && (
        <SaveToDocModal
          content={saveModalContent}
          onClose={() => setSaveModalContent(null)}
        />
      )}
    </div>
  );
}

function isTaskPlan(value: unknown): value is TaskPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as TaskPlan;
  return typeof plan.id === "string" && Array.isArray(plan.steps);
}

function isToolErrorResult(result: string): boolean {
  const trimmed = result.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed === "Tool not found." || trimmed.startsWith("Tool error:")) {
    return true;
  }

  try {
    const parsed = JSON.parse(trimmed) as { success?: unknown; error?: unknown };
    return parsed.success === false || typeof parsed.error === "string";
  } catch {
    return false;
  }
}


function nextEventOrder(ref: MutableRefObject<number>): number {
  ref.current += 1;
  return ref.current;
}
