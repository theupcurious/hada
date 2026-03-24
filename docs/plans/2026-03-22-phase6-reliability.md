# Phase 6 Reliability & UX Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the agent loop and dramatically improve the chat UX with streaming responses, proper markdown rendering, error surfacing, and transient error recovery.

**Architecture:** Four independent improvements applied in order of increasing complexity. Tasks 1-3 are isolated server or UI changes. Task 4 (streaming) threads through both the API route and the client and is the biggest change.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript. No test runner — verification is `npm run build` + `npm run lint` + manual dev-server testing. New dependency: `react-markdown` + `remark-gfm`.

---

## Task 1: Transient error retry in the agent loop

Detect rate-limit (429) and transient network errors in `callLLM` and retry up to 2× with exponential backoff before propagating the error to the agent loop's error counter.

**Files:**
- Modify: `src/lib/chat/agent-loop.ts`

---

### Step 1: Add helper functions after the existing `isAbortError` function

In [src/lib/chat/agent-loop.ts](src/lib/chat/agent-loop.ts) after line 329, add:

```typescript
function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && /\(429\)/.test(error.message);
}

function isTransientError(error: unknown): boolean {
  if (isRateLimitError(error)) return true;
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("fetch failed");
}

async function callLLMWithRetry(
  options: Parameters<typeof callLLM>[0],
  maxRetries = 2,
): Promise<Awaited<ReturnType<typeof callLLM>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callLLM(options);
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
      if (!isTransientError(error) || attempt >= maxRetries) throw error;
      const delayMs = isRateLimitError(error)
        ? Math.pow(2, attempt + 1) * 1_000 // 2s, 4s
        : 1_000;
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
```

### Step 2: Replace `callLLM` with `callLLMWithRetry` in the loop body

In [src/lib/chat/agent-loop.ts:62](src/lib/chat/agent-loop.ts#L62), change:
```typescript
        const result = await callLLM({
```
to:
```typescript
        const result = await callLLMWithRetry({
```

### Step 3: Verify it builds

```bash
npm run build
```
Expected: no TypeScript errors.

### Step 4: Commit

```bash
git add src/lib/chat/agent-loop.ts
git commit -m "feat: retry transient LLM errors with exponential backoff"
```

---

## Task 2: Replace hand-rolled MessageContent with react-markdown

The current renderer in the chat page is missing code blocks, ordered lists, links, inline code, blockquotes, and tables. Replace it with `react-markdown` + `remark-gfm`. Also remove the server-side table-to-bullets conversion (now redundant, and harmful to web rendering).

**Files:**
- Modify: `src/lib/chat/agent-loop.ts` (remove `normalizeMarkdownTables` call and helper functions)
- Modify: `src/app/chat/page.tsx` (replace `MessageContent` component)

---

### Step 1: Install dependencies

```bash
npm install react-markdown remark-gfm
```

### Step 2: Remove the table conversion call from `sanitizeAssistantContent`

In [src/lib/chat/agent-loop.ts:365](src/lib/chat/agent-loop.ts#L365), delete the line:
```typescript
  output = normalizeMarkdownTables(output);
```

### Step 3: Delete the now-unused table helper functions

Remove the five functions at the bottom of [src/lib/chat/agent-loop.ts](src/lib/chat/agent-loop.ts): `normalizeMarkdownTables` (line 387), `isPotentialTableLine` (line 413), `isTableSeparatorLine` (line 417), `parseTableRow` (line 427), and `tableToBullets` (line 436). Delete everything from line 387 to the end of the file.

### Step 4: Replace the `MessageContent` component in the chat page

In [src/app/chat/page.tsx](src/app/chat/page.tsx), add the imports after the existing imports block:

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

Replace the entire `renderInlineBold` function and the entire `MessageContent` component (lines 76–156) with:

```typescript
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
```

### Step 5: Verify build

```bash
npm run build
```
Expected: no errors. If TypeScript complains about `react-markdown` or `remark-gfm` types, run `npm install --save-dev @types/remark-gfm` (usually not needed as these packages ship their own types).

### Step 6: Manual smoke test

```bash
npm run dev
```
Open `http://localhost:3000/chat`, send a message that should produce markdown (e.g. "list 5 planets with a table"). Verify bullets, bold, and tables render correctly.

### Step 7: Commit

```bash
git add src/lib/chat/agent-loop.ts src/app/chat/page.tsx package.json package-lock.json
git commit -m "feat: replace hand-rolled markdown renderer with react-markdown + remark-gfm"
```

---

## Task 3: Surface agent errors to the UI

The `gatewayError` field is saved to the message metadata but never returned to the client. Add it to the API response and show a distinct error style in the chat UI.

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/chat/page.tsx`

---

### Step 1: Add `isError` flag to the `Message` interface in the chat page

In [src/app/chat/page.tsx:17](src/app/chat/page.tsx#L17), add `isError?: boolean` to the `Message` interface:

```typescript
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
  isError?: boolean;
}
```

### Step 2: Return `isError` from the chat API route

In [src/app/api/chat/route.ts:30](src/app/api/chat/route.ts#L30), change the `NextResponse.json(...)` return to include the error flag:

```typescript
    return NextResponse.json({
      id: result.assistantMessageId,
      content: result.response,
      role: "assistant",
      conversationId: result.conversationId,
      userMessageId: result.userMessageId,
      isError: !!result.metadata.gatewayError,
      errorMessage: result.metadata.gatewayError?.message,
    });
```

### Step 3: Map `isError` when building the assistant message in the client

In [src/app/chat/page.tsx](src/app/chat/page.tsx) inside the `sendMessage` function, in the `assistantMessage` object construction (currently around line 342), add:

```typescript
      const assistantMessage: Message = {
        id: data.id || `temp-${Date.now() + 1}`,
        role: "assistant",
        content: data.content || data.error || "Sorry, I encountered an error.",
        thinking: data.thinking,
        cards: data.cards,
        isError: !!data.isError,
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
```

### Step 4: Style error messages differently in the message renderer

In [src/app/chat/page.tsx](src/app/chat/page.tsx), find the message render block (around line 585) and wrap `<MessageContent>` with a conditional error class:

```typescript
                        <div className="flex-1 pt-1 space-y-3">
                          <div className={message.isError ? "text-red-500 dark:text-red-400" : undefined}>
                            <MessageContent content={message.content} />
                          </div>
```

### Step 5: Verify build and lint

```bash
npm run build && npm run lint
```

### Step 6: Commit

```bash
git add src/app/api/chat/route.ts src/app/chat/page.tsx
git commit -m "feat: surface agent errors to chat UI with error styling"
```

---

## Task 4: Streaming chat API with SSE

Replace the current request/response JSON pattern with Server-Sent Events. The API route streams `AgentEvent` objects as SSE, and the client renders text deltas incrementally. This is the largest change.

**Files:**
- Modify: `src/app/api/chat/route.ts` (full rewrite)
- Modify: `src/app/chat/page.tsx` (rewrite `sendMessage` + loading state)

---

### Step 1: Rewrite the chat API route to stream SSE

Replace the entire content of [src/app/api/chat/route.ts](src/app/api/chat/route.ts) with:

```typescript
import { NextRequest } from "next/server";
import { processMessage } from "@/lib/chat/process-message";
import { createClient } from "@/lib/supabase/server";
import type { AgentEvent } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const emit = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected — writes will fail silently.
        }
      };

      processMessage({
        userId: user.id,
        message,
        source: "web",
        supabase,
        onEvent: (event: AgentEvent) => {
          emit(event);
        },
      })
        .then((result) => {
          emit({
            type: "complete",
            id: result.assistantMessageId,
            conversationId: result.conversationId,
            userMessageId: result.userMessageId,
            isError: !!result.metadata.gatewayError,
            errorMessage: result.metadata.gatewayError?.message,
          });
        })
        .catch((error: unknown) => {
          emit({
            type: "error",
            message:
              error instanceof Error ? error.message : "Internal server error",
          });
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
```

### Step 2: Add `isStreaming` to the `Message` interface in the chat page

In [src/app/chat/page.tsx:17](src/app/chat/page.tsx#L17), add `isStreaming?: boolean` to the `Message` interface (keep `isError` from Task 3):

```typescript
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
  isError?: boolean;
  isStreaming?: boolean;
}
```

### Step 3: Rewrite the `sendMessage` function in the chat page

In [src/app/chat/page.tsx](src/app/chat/page.tsx), replace the entire `sendMessage` function (lines 301–375) with:

```typescript
  const sendMessage = async (overrideMessage?: string) => {
    const messageText = overrideMessage ?? input;
    if (!messageText.trim() || isLoading) return;

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: "user",
        content: messageText.trim(),
        created_at: new Date().toISOString(),
      },
      {
        id: tempAssistantId,
        role: "assistant",
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
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
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

          if (event.type === "text_delta" && typeof event.content === "string") {
            setIsThinking(false);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, content: msg.content + event.content }
                  : msg,
              ),
            );
          } else if (event.type === "tool_call") {
            setIsThinking(true);
          } else if (event.type === "complete") {
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
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? {
                      ...msg,
                      content:
                        String(event.message ?? "Sorry, I encountered an error."),
                      isStreaming: false,
                      isError: true,
                    }
                  : msg,
              ),
            );
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId
            ? {
                ...msg,
                content:
                  "Sorry, I'm having trouble connecting. Please try again.",
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
```

### Step 4: Update the loading bubble to only show when the placeholder assistant message has no content yet

The existing loading bubble (around line 645) shows whenever `isLoading` is true. Now that we add a placeholder assistant message immediately, the bubble is redundant once content starts arriving. Replace the loading bubble block with a version that only shows when `isLoading` is true AND the last message is the (still-empty) streaming placeholder:

Find the block starting with `{isLoading && (` and replace it with:

```typescript
                {isLoading && isThinking && (
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
                        Thinking...
                      </span>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                    </div>
                  </motion.div>
                )}
```

### Step 5: Add a streaming cursor to the assistant message while content is arriving

In the message render block (around line 585), add a blinking cursor after `<MessageContent>` for streaming messages:

```typescript
                        <div className="flex-1 pt-1 space-y-3">
                          <div className={message.isError ? "text-red-500 dark:text-red-400" : undefined}>
                            <MessageContent content={message.content} />
                            {message.isStreaming && message.content && (
                              <span className="inline-block h-4 w-0.5 bg-zinc-400 animate-pulse ml-0.5" />
                            )}
                          </div>
```

### Step 6: Verify build

```bash
npm run build
```
Expected: no TypeScript errors. Pay attention to the `processMessage` `onEvent` callback type — it accepts `AgentEvent` which is already typed in `database.ts`.

### Step 7: Manual integration test

```bash
npm run dev
```

1. Open `http://localhost:3000/chat`, log in.
2. Send a short message (no tools). Verify: text streams in character-by-character, cursor blinks, loading indicator goes away as soon as text arrives.
3. Send "search the web for today's news". Verify: "Thinking..." shows during tool execution, then text streams in after the tool result.
4. Send a malformed request from the browser console: `fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message:''})})` — should return 400 JSON (not a stream).
5. Check DB in Supabase: verify user + assistant messages are saved correctly after a streamed conversation.

### Step 8: Commit

```bash
git add src/app/api/chat/route.ts src/app/chat/page.tsx
git commit -m "feat: stream chat responses via SSE for real-time text rendering"
```

---

## Completion Checklist

- [ ] Task 1: Transient retry — rate-limit errors retry without counting toward `maxErrors`
- [ ] Task 2: react-markdown — code blocks, tables, links, ordered lists render correctly
- [ ] Task 3: Error surfacing — agent errors shown with red styling in UI
- [ ] Task 4: Streaming — text appears incrementally; tool calls show "Thinking..." while running
- [ ] All tasks: `npm run build` passes with no TypeScript errors
- [ ] ROADMAP.md Phase 6 items marked complete
