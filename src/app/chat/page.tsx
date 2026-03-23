"use client";

export const dynamic = "force-dynamic";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { useHealthStatus } from "@/lib/hooks/use-health-status";
import { CalendarEventCard, type CalendarEventCardProps } from "@/components/chat/calendar-event-card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  cards?: ChatCard[];
  confirmation?: {
    pending: boolean;
    function?: {
      name: string;
      arguments: Record<string, unknown>;
    };
  };
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
    <div className="text-sm leading-relaxed space-y-1 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5 mb-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5 mb-2">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug">{children}</li>,
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
            <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic text-zinc-500 dark:text-zinc-400 mb-2">
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
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [greetingText, setGreetingText] = useState("Hello");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    created_at: msg.created_at,
  });

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

    const tempId = `temp-${Date.now()}`;
    const userMessage: Message = {
      id: tempId,
      role: "user",
      content: messageText.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideMessage) {
      setInput("");
    }
    setIsLoading(true);

    try {
      setIsThinking(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
        }),
      });

      const data = await response.json();

      // Update user message with real ID from database
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...msg, id: data.userMessageId || msg.id }
            : msg
        )
      );

      const assistantMessage: Message = {
        id: data.id || `temp-${Date.now() + 1}`,
        role: "assistant",
        content: data.content || data.error || "Sorry, I encountered an error.",
        thinking: data.thinking,
        cards: data.cards,
        confirmation: data.confirmation?.pending
          ? {
              pending: true,
              function: data.confirmation?.function
                ? {
                    name: data.confirmation.function.name || "",
                    arguments: data.confirmation.function.arguments || {},
                  }
                : undefined,
            }
          : undefined,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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

  const inputForm = (
    <form onSubmit={handleSubmit}>
      <div className="relative rounded-2xl border border-border/80 bg-card/70 shadow-sm backdrop-blur-sm">
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
          className="absolute bottom-2 right-2 rounded-xl"
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
        Enter to send, Shift+Enter for a new line. Hada can make mistakes - verify important information.
      </p>
    </form>
  );

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-zinc-200 px-4 py-3 dark:bg-zinc-900/80 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black dark:bg-white">
            <span className="text-sm font-bold text-white dark:text-black">H</span>
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
                ) : messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black dark:bg-white mb-6">
                      <span className="text-2xl font-bold text-white dark:text-black">H</span>
                    </div>
                    <h1 className="text-3xl font-semibold">
                      {greetingText}, {user?.name || "there"}
                    </h1>
                    <p className="mt-2 text-zinc-500 text-lg">What can I help you with today?</p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2 w-full max-w-xl">
                      {[
                        "What's on my calendar today?",
                        "Draft an email to my team",
                        "Book a restaurant for Friday",
                        "Research the best project management tools",
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setInput(suggestion);
                            requestAnimationFrame(() => textareaRef.current?.focus());
                          }}
                          className="rounded-lg border border-border/80 bg-card/70 p-4 text-left text-sm backdrop-blur-sm transition-all hover:bg-card/90 hover:border-border"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>

                    <div className="mt-8 w-full max-w-xl">
                      {inputForm}
                    </div>
                  </motion.div>
                ) : (
                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex gap-3"
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback
                            className={
                              message.role === "assistant"
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "bg-zinc-200 dark:bg-zinc-700"
                            }
                          >
                            {message.role === "assistant" ? "H" : user?.name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 pt-1 space-y-3">
                          <MessageContent content={message.content} />
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

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-black text-white dark:bg-white dark:text-black">
                        H
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                        {isThinking ? "Thinking..." : "Typing..."}
                      </span>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                    </div>
                  </motion.div>
                )}
                <div ref={endOfMessagesRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input Area - Fixed at bottom when there are messages */}
          {messages.length > 0 && (
            <div className="shrink-0 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 bg-background/90 border-t border-border/70 backdrop-blur-sm">
              {inputForm}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
