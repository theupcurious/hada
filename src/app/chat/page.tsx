"use client";

export const dynamic = "force-dynamic";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  source?: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [greetingText, setGreetingText] = useState("Hello");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    endOfMessagesRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const autosizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`; // cap growth to keep UX stable
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUser({
        email: user.email,
        name: user.user_metadata?.name,
      });
    };
    getUser();
  }, [router, supabase]);

  useEffect(() => {
    // Ensure the newest message (or loader) is visible.
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [messages, isLoading, isThinking]);

  useEffect(() => {
    autosizeTextarea();
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content || data.error || "Sorry, I encountered an error.",
        thinking: data.thinking,
        source: data.source,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
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

  const inputForm = (
    <form onSubmit={handleSubmit}>
      <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
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
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 hidden sm:block">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col max-w-3xl mx-auto px-4">

          {/* Messages Area */}
          <div className="flex-1 py-4">
            <ScrollArea className="h-full">
              <div className="space-y-6 pb-4">
                {messages.length === 0 ? (
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
                          className="rounded-xl border border-zinc-200 bg-white p-4 text-left text-sm transition-all hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
                        <div className="flex-1 pt-1">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          {message.role === "assistant" && message.source && (
                            <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                              via {message.source}
                            </p>
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

          {/* Input Area - Sticky once there are messages */}
          {messages.length > 0 && (
            <div className="sticky bottom-0 -mx-4 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95">
              {inputForm}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
