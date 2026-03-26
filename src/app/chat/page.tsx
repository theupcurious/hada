"use client";

export const dynamic = "force-dynamic";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { useHealthStatus } from "@/lib/hooks/use-health-status";
import { CalendarEventCard, type CalendarEventCardProps } from "@/components/chat/calendar-event-card";
import { AgentTraceTimeline, type TraceEvent, type ThinkingEvent } from "@/components/chat/agent-trace";
import { TaskPlanCard } from "@/components/chat/task-plan-card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { TaskPlan } from "@/lib/types/database";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback, type MutableRefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
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
    gatewayError?: { code: string; message: string };
    confirmation?: {
      pending?: boolean;
      function?: {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    };
  } | null;
  created_at: string;
}

type CalendarEventCardData = CalendarEventCardProps["event"];

interface CalendarEventCardPayload {
  type: "calendar_event";
  data?: CalendarEventCardData;
  actions?: string[];
}

interface CalendarEventsListPayload {
  type: "calendar_events_list";
  data?: {
    events?: CalendarEventCardData[];
  };
}

type ChatCard =
  | CalendarEventCardPayload
  | CalendarEventsListPayload
  | {
      type?: string;
      data?: unknown;
      actions?: string[];
    };

function MessageContent({ content }: { content: string }) {
  return (
    <div className="min-w-0 break-words text-sm leading-relaxed space-y-1 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5 mb-2 break-words">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5 mb-2 break-words">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug break-words">{children}</li>,
          h1: ({ children }) => (
            <p className="font-semibold mb-1">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="font-semibold mb-1">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="font-semibold mb-1">{children}</p>
          ),
          h4: ({ children }) => (
            <p className="font-semibold mb-1">{children}</p>
          ),
          h5: ({ children }) => (
            <p className="font-semibold mb-1">{children}</p>
          ),
          h6: ({ children }) => (
            <p className="font-semibold mb-1">{children}</p>
          ),
          pre: ({ children }) => (
            <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto text-xs font-mono mb-2 whitespace-pre">
              {children}
            </pre>
          ),
          code: ({ className, children }) => {
            const isBlock = !!className;
            return isBlock ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5 text-xs font-mono">
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic text-zinc-500 dark:text-zinc-400 mb-2 break-words">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="text-xs border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5">
              {children}
            </td>
          ),
          hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-700" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function isCalendarEventData(value: unknown): value is CalendarEventCardData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    typeof event.summary === "string" &&
    typeof event.start === "string" &&
    typeof event.end === "string"
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [greetingText, setGreetingText] = useState("Hello");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventOrderRef = useRef(0);
  const router = useRouter();
  const supabase = createClient();
  const { status: connectionStatus } = useHealthStatus(30000); // Poll every 30s

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    endOfMessagesRef.current?.scrollIntoView({ behavior, block: "end" });
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
    isError: !!msg.metadata?.gatewayError,
    created_at: msg.created_at,
  });

  const updateMessage = useCallback((messageId: string, updater: (message: Message) => Message) => {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? updater(message) : message)));
  }, []);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUser({
        email: user.email,
        name: user.user_metadata?.name,
      });

      // Load message history
      await loadHistory();
      setIsLoadingHistory(false);
    };
    initialize();
  }, [router, supabase, loadHistory]);

  useEffect(() => {
    // Ensure the newest message (or loader) is visible.
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [messages, isLoading, isThinking]);

  useEffect(() => {
    autosizeTextarea();
  }, [input]);

  const sendMessage = async (overrideMessage?: string) => {
    const messageText = overrideMessage ?? input;
    if (!messageText.trim() || isLoading) return;
    setShowConversation(true);

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
    setIsLoading(true);
    setIsThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText.trim() }),
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(errData.error ?? `Request failed: ${response.status}`));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedTerminalEvent = false;
      eventOrderRef.current = 0;

      const processStreamEvent = (event: Record<string, unknown>) => {
        if (event.type === "text_delta" && typeof event.content === "string") {
          setIsThinking(false);
          updateMessage(tempAssistantId, (message) => ({
            ...message,
            content: message.content + event.content,
          }));
        } else if (event.type === "tool_call") {
          setIsThinking(true);
          const order = nextEventOrder(eventOrderRef);
          const callId = typeof event.callId === "string" ? event.callId : `call_${Date.now()}`;
          const name = typeof event.name === "string" ? event.name : "unknown";
          const args = (event.args && typeof event.args === "object") ? event.args as Record<string, unknown> : {};
          updateMessage(tempAssistantId, (message) => ({
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
        } else if (event.type === "tool_result") {
          const callId = typeof event.callId === "string" ? event.callId : "";
          const result = typeof event.result === "string" ? event.result : "";
          const durationMs = typeof event.durationMs === "number" ? event.durationMs : undefined;
          const truncated = !!event.truncated;
          updateMessage(tempAssistantId, (message) => ({
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
        } else if (event.type === "thinking" && typeof event.content === "string") {
          const order = nextEventOrder(eventOrderRef);
          updateMessage(tempAssistantId, (message) => ({
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
        } else if (event.type === "delegation_started") {
          const agentName = typeof event.agentName === "string" ? event.agentName : "subagent";
          updateMessage(tempAssistantId, (message) => ({
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
        } else if (event.type === "delegation_completed") {
          // The parent delegate_task tool_result closes the trace with the real callId.
        } else if (event.type === "plan_created" && isTaskPlan(event.plan)) {
          const plan = event.plan;
          updateMessage(tempAssistantId, (message) => ({
            ...message,
            plan,
            activeStepId: undefined,
          }));
        } else if (event.type === "step_started") {
          const stepId = typeof event.stepId === "string" ? event.stepId : "";
          updateMessage(tempAssistantId, (message) => ({
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
        } else if (event.type === "step_completed") {
          const stepId = typeof event.stepId === "string" ? event.stepId : "";
          updateMessage(tempAssistantId, (message) => ({
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
        } else if (event.type === "step_failed") {
          const stepId = typeof event.stepId === "string" ? event.stepId : "";
          updateMessage(tempAssistantId, (message) => ({
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
        } else if (event.type === "complete") {
          receivedTerminalEvent = true;
          const realAssistantId = String(event.id ?? tempAssistantId);
          const realUserId = String(event.userMessageId ?? tempUserId);
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === tempUserId) return { ...msg, id: realUserId };
              if (msg.id === tempAssistantId) {
                return {
                  ...msg,
                  id: realAssistantId,
                  isStreaming: false,
                  isError: !!event.isError,
                };
              }
              return msg;
            }),
          );
        } else if (event.type === "error") {
          receivedTerminalEvent = true;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? {
                    ...msg,
                    content: String(event.message ?? "Sorry, I encountered an error."),
                    isStreaming: false,
                    isError: true,
                  }
                : msg,
            ),
          );
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
            msg.id === tempAssistantId
              ? {
                  ...msg,
                  content: msg.content.trim()
                    ? `${msg.content}\n\nResponse interrupted before completion. Please try again.`
                    : "Response interrupted before completion. Please try again.",
                  isStreaming: false,
                  isError: true,
                }
              : msg,
          ),
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId
            ? {
                ...msg,
                content: error instanceof Error
                  ? error.message
                  : "Sorry, I'm having trouble connecting. Please try again.",
                isStreaming: false,
                isError: true,
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
      title: "Brief me on my day",
      subtitle: "Calendar, weather & priorities",
      icon: "☀️",
      prompt:
        "Brief me on my day. Check my calendar for today's events, look up the current weather, recall anything you remember about my priorities or pending tasks, and give me a concise morning briefing with everything I need to know.",
    },
    {
      title: "Research & summarize",
      subtitle: "Deep dive with a written memo",
      icon: "🔍",
      prompt:
        "Research the latest developments in AI agents and write me a structured summary memo. Search multiple sources, read the most relevant articles, and organize your findings into key themes with takeaways.",
    },
    {
      title: "Plan my week",
      subtitle: "Goals, calendar gaps & focus time",
      icon: "📋",
      prompt:
        "Help me plan my week. Check my calendar for the upcoming week, recall my goals and priorities, identify open time blocks, and suggest a plan that balances my commitments with focused work time.",
    },
    {
      title: "Catch me up",
      subtitle: "Personalized news since last chat",
      icon: "⚡",
      prompt:
        "Catch me up on what's happened since we last talked. Recall what topics I care about, search for the latest news and developments, and only tell me what's actually new — skip anything I already know.",
    },
  ];

  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim());
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.trim());
  const shouldShowLanding = !showConversation && !isLoading;

  const inputForm = (
    <form onSubmit={handleSubmit}>
      <div className="glass relative rounded-2xl">
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
          className="w-full resize-none bg-transparent px-4 py-4 pr-12 text-sm leading-6 outline-none placeholder:text-zinc-400 disabled:opacity-60"
          disabled={isLoading}
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          size="sm"
          className="absolute bottom-2 right-2 rounded-xl gradient-brand text-white border-0 shadow-md shadow-teal-500/20 disabled:opacity-40"
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
      <p className="mt-2 text-center text-xs text-zinc-400">
        Enter to send, Shift+Enter for a new line. Hada can make mistakes — verify important information.
      </p>
    </form>
  );

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}

      <header className="flex items-center justify-between bg-white/70 backdrop-blur-md border-b border-zinc-200/80 px-4 py-3 dark:bg-zinc-900/60 dark:border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand shadow-md shadow-teal-500/20">
            <span className="text-sm font-bold text-white">H</span>
          </div>
          <span className="font-semibold">Hada</span>
          {/* Connection status indicator */}
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
          <ThemeToggle />
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" aria-label="Open dashboard">
              <LayoutDashboard className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              Settings
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col max-w-3xl mx-auto px-4">

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
              <div className="space-y-6 pb-6">
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
                    className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
                  >
                    <div className="relative mb-6">
                      <div className="absolute inset-0 -m-3 rounded-3xl bg-gradient-to-br from-teal-500/20 via-cyan-500/15 to-teal-400/20 blur-xl" style={{ animation: "glow-pulse 3s ease-in-out infinite" }} />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-teal-500/25">
                        <span className="text-2xl font-bold text-white">H</span>
                      </div>
                    </div>
                    <h1 className="text-3xl font-semibold">
                      <span className="gradient-text">{greetingText}</span>, {user?.name || "there"}
                    </h1>
                    <p className="mt-2 text-zinc-500 text-lg">What can I help you with today?</p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2 w-full max-w-xl">
                      {starterPrompts.map((shortcut) => (
                        <button
                          key={shortcut.title}
                          onClick={() => void sendMessage(shortcut.prompt)}
                          className="glass group rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-teal-500/5"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-lg leading-none mt-0.5">{shortcut.icon}</span>
                            <div>
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {shortcut.title}
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                {shortcut.subtitle}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {messages.length > 0 ? (
                      <div className="mt-6 w-full max-w-xl rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              Continue where you left off
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              Persistent context is still available. Open the conversation if you want to review or continue it directly.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowConversation(true)}
                          >
                            Open chat
                          </Button>
                        </div>
                        {latestUserMessage ? (
                          <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950/60">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                              Last request
                            </p>
                            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                              {truncatePreview(latestUserMessage.content, 180)}
                            </p>
                          </div>
                        ) : null}
                        {latestAssistantMessage ? (
                          <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950/60">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                              Last reply
                            </p>
                            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                              {truncatePreview(latestAssistantMessage.content, 220)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-8 w-full max-w-xl">
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
                        className="flex gap-3 min-w-0"
                      >
                        {message.role === "assistant" ? (
                          <div className="h-8 w-8 shrink-0 rounded-full avatar-accent-ring">
                            <Avatar className="h-full w-full">
                              <AvatarFallback className="gradient-brand text-white text-xs font-bold">
                                H
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        ) : (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700">
                              {user?.name?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0 flex-1 pt-1 space-y-3">
                          {/* Agent trace timeline */}
                          {message.role === "assistant" && (message.traceEvents?.length || message.thinkingEvents?.length) ? (
                            <AgentTraceTimeline
                              traces={message.traceEvents || []}
                              thinking={message.thinkingEvents || []}
                            />
                          ) : null}
                          {message.role === "assistant" && message.plan ? (
                            <TaskPlanCard plan={message.plan} activeStepId={message.activeStepId} />
                          ) : null}
                          <div className={message.isError ? "text-red-500 dark:text-red-400" : undefined}>
                            {message.isStreaming && !message.content ? (
                              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-50/80 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-zinc-400">
                                <div className="bounce-dots">
                                  <span />
                                  <span />
                                  <span />
                                </div>
                                <span>{getStreamingStatusLabel(message)}</span>
                              </div>
                            ) : null}
                            <MessageContent content={message.content} />
                            {message.isStreaming && message.content && (
                              <span className="inline-block h-4 w-0.5 bg-zinc-400 animate-pulse ml-0.5" />
                            )}
                          </div>
                          {/* Render calendar cards */}
                          {message.cards?.map((card, idx) => {
                            if (card.type === "calendar_event" && isCalendarEventData(card.data)) {
                              return (
                                <CalendarEventCard
                                  key={`${message.id}-card-${idx}`}
                                  event={card.data}
                                  actions={card.actions}
                                />
                              );
                            }
                            // Handle list of events
                            if (
                              card.type === "calendar_events_list" &&
                              Array.isArray((card.data as { events?: unknown[] } | undefined)?.events)
                            ) {
                              const events = (card.data as { events: unknown[] }).events;
                              return events
                                .filter((event) => isCalendarEventData(event))
                                .map((event, eventIdx: number) => (
                                  <CalendarEventCard
                                    key={`${message.id}-card-${idx}-event-${eventIdx}`}
                                    event={event}
                                    actions={["reschedule", "cancel"]}
                                  />
                                ));
                            }
                            return null;
                          })}
                          {message.role === "assistant" && message.confirmation?.pending && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-full"
                                onClick={() => handleQuickReply("confirm")}
                                disabled={isLoading}
                              >
                                Confirm
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => handleQuickReply("cancel")}
                                disabled={isLoading}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
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
            <div className="shrink-0 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 bg-background/80 border-t border-border/50 backdrop-blur-md">
              {inputForm}
            </div>
          )}
        </div>
      </div>
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

function truncatePreview(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function getStreamingStatusLabel(message: Message): string {
  const traces = message.traceEvents || [];

  if (traces.some((trace) => trace.status === "running")) {
    return "Running tools...";
  }

  if (traces.length > 0) {
    return "Reviewing results...";
  }

  if (message.plan) {
    return "Working through the plan...";
  }

  if ((message.thinkingEvents || []).length > 0) {
    return "Thinking...";
  }

  return "Starting...";
}

function nextEventOrder(ref: MutableRefObject<number>): number {
  ref.current += 1;
  return ref.current;
}
