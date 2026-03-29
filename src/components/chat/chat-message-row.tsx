"use client";

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CalendarEventCard } from "@/components/chat/calendar-event-card";
import { DataTableCard } from "@/components/chat/data-table-card";
import { SmartCard } from "@/components/chat/smart-cards";
import { RichMessageContent } from "@/components/chat/rich-message-content";
import { AgentTraceTimeline, type TraceEvent, type ThinkingEvent } from "@/components/chat/agent-trace";
import { buildToolStatusPills } from "@/lib/chat/tool-status";
import { ToolStatusPills } from "@/components/chat/tool-status-pills";
import { ScheduleViewCard } from "@/components/chat/schedule-view-card";
import { TaskPlanCard } from "@/components/chat/task-plan-card";
import { MessageActions } from "@/components/chat/message-actions";
import { FollowUpChips } from "@/components/chat/follow-up-chips";
import type { TaskPlan } from "@/lib/types/database";
import type {
  CalendarEventCardData,
  CalendarEventCardPayload,
  CalendarEventsListPayload,
  ChatCard,
  DataTableCardPayload,
  ScheduleBlock,
  ScheduleViewCardPayload,
} from "@/lib/types/cards";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ChatMessageRowMessage {
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
  streamSegments?: Array<{
    id: string;
    text: string;
  }>;
  isError?: boolean;
  isStreaming?: boolean;
  created_at: string;
}

interface ChatMessageRowProps {
  message: ChatMessageRowMessage;
  userName?: string;
  isLoading?: boolean;
  onQuickReply: (text: string) => void;
  onCopy: (messageId: string, content: string) => Promise<void>;
  onRegenerate: (messageId: string) => Promise<void>;
  onFeedback: (messageId: string, value: "up" | "down") => Promise<void>;
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


function UserMessageContent({ content }: { content: string }) {
  return (
    <div className="min-w-0 w-full max-w-full overflow-hidden text-sm leading-relaxed space-y-1 [overflow-wrap:anywhere] [&>*]:min-w-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5 break-words [overflow-wrap:anywhere]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5 break-words [overflow-wrap:anywhere]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug break-words [overflow-wrap:anywhere]">{children}</li>,
          h1: ({ children }) => (
            <p className="mt-3 mb-2 text-base font-bold text-zinc-900 first:mt-0 dark:text-zinc-100">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mt-3 mb-1.5 text-sm font-bold text-zinc-900 first:mt-0 dark:text-zinc-100">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mt-2 mb-1 font-semibold text-zinc-900 first:mt-0 dark:text-zinc-100">{children}</p>
          ),
          h4: ({ children }) => (
            <p className="mt-2 mb-1 font-semibold text-zinc-700 first:mt-0 dark:text-zinc-300">{children}</p>
          ),
          h5: ({ children }) => (
            <p className="font-medium mb-1 text-zinc-600 dark:text-zinc-400">{children}</p>
          ),
          h6: ({ children }) => (
            <p className="font-medium mb-1 text-zinc-500 dark:text-zinc-500">{children}</p>
          ),
          pre: ({ children }) => (
            <pre className="mb-2 max-w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs whitespace-pre dark:bg-zinc-800">
              {children}
            </pre>
          ),
          code: ({ className, children }) => {
            const isBlock = !!className;
            return isBlock ? (
              <code className={`${className} break-words`}>{children}</code>
            ) : (
              <code className="break-all rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-blue-600 underline hover:no-underline dark:text-blue-400"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-4 border-zinc-300 pl-4 italic break-words text-zinc-500 [overflow-wrap:anywhere] dark:border-zinc-600 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[20rem] border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-zinc-100 px-3 py-2 break-words align-top text-zinc-700 dark:border-zinc-800/60 dark:text-zinc-300">
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

export function ChatMessageRow({
  message,
  userName,
  isLoading,
  onQuickReply,
  onCopy,
  onRegenerate,
  onFeedback,
}: ChatMessageRowProps) {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const pills = useMemo(
    () =>
      message.isStreaming
        ? buildToolStatusPills({
            isStreaming: true,
            traces: message.traceEvents ?? [],
            thinkingCount: message.thinkingEvents?.length ?? 0,
            hasVisibleContent: (message.content?.length ?? 0) > 0,
            backgroundJobPending: message.backgroundJob?.pending ?? false,
          })
        : [],
    [message.isStreaming, message.traceEvents, message.thinkingEvents, message.content, message.backgroundJob],
  );

  const handleCopy = async () => {
    await onCopy(message.id, message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    await onRegenerate(message.id);
  };

  const handleFeedback = async (value: "up" | "down") => {
    await onFeedback(message.id, value);
  };

  const showActions =
    message.role === "assistant" &&
    !message.isStreaming &&
    message.content.trim().length > 0;

  return (
    <div
      className="flex min-w-0 gap-2 sm:gap-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
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
            {userName?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1 overflow-hidden pt-1 space-y-3">
        {/* Agent trace timeline */}
        {message.role === "assistant" &&
          (message.traceEvents?.length || message.thinkingEvents?.length) ? (
          <AgentTraceTimeline
            key={`${message.id}-${message.isStreaming ? "streaming" : "idle"}`}
            traces={message.traceEvents || []}
            thinking={message.thinkingEvents || []}
            isStreaming={message.isStreaming}
          />
        ) : null}

        {/* Task plan */}
        {message.role === "assistant" && message.plan ? (
          <TaskPlanCard plan={message.plan} activeStepId={message.activeStepId} />
        ) : null}

        {/* Status pills */}
        {message.role === "assistant" && message.isStreaming && pills.length > 0 ? (
          <ToolStatusPills pills={pills} />
        ) : null}

        {/* Message content */}
        <div
          className={`min-w-0 overflow-hidden ${message.isError ? "text-red-500 dark:text-red-400" : ""}`}
        >
          {message.isStreaming && !message.content && pills.length === 0 ? (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-50/80 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-zinc-400">
              <div className="bounce-dots">
                <span />
                <span />
                <span />
              </div>
              <span>Starting…</span>
            </div>
          ) : null}
          {message.role === "assistant" ? (
            <RichMessageContent content={message.content} isStreaming={message.isStreaming} />
          ) : (
            <UserMessageContent content={message.content} />
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block h-4 w-0.5 bg-zinc-400 animate-pulse ml-0.5" />
          )}
        </div>

        {/* Cards */}
        {message.cards?.map((card, idx) => {
          if (card.type === "calendar_event" && isCalendarEventData(card.data)) {
            return (
              <CalendarEventCard
                key={`${message.id}-card-${idx}`}
                event={card.data}
                actions={(card as CalendarEventCardPayload).actions}
              />
            );
          }
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
          if (card.type === "schedule_view") {
            const data = card.data as ScheduleViewCardPayload["data"] | undefined;
            if (data?.blocks?.length) {
              return (
                <ScheduleViewCard
                  key={`${message.id}-card-${idx}`}
                  title={data.title || "Schedule"}
                  timeframe={data.timeframe || ""}
                  blocks={data.blocks as ScheduleBlock[]}
                />
              );
            }
          }
          if (card.type === "data_table") {
            const data = card.data as DataTableCardPayload["data"] | undefined;
            if (data?.headers?.length && data?.rows?.length) {
              return (
                <DataTableCard
                  key={`${message.id}-card-${idx}`}
                  title={data.title}
                  headers={data.headers}
                  rows={data.rows}
                />
              );
            }
          }
          if (
            card.type === "comparison" ||
            card.type === "steps" ||
            card.type === "checklist"
          ) {
            return (
              <SmartCard
                key={`${message.id}-card-${idx}`}
                type={card.type}
                data={card.data}
                onAction={(msg) => onQuickReply(msg)}
              />
            );
          }
          return null;
        })}

        {/* Confirmation buttons */}
        {message.role === "assistant" && message.confirmation?.pending && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => onQuickReply("confirm")}
              disabled={isLoading}
            >
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => onQuickReply("cancel")}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Message actions hover toolbar */}
        {showActions && (
          <div
            className={`transition-opacity duration-150 ${isHovered ? "opacity-100" : "opacity-0"}`}
          >
            <MessageActions
              copied={copied}
              feedbackValue={message.feedback?.value}
              onCopy={handleCopy}
              onRegenerate={handleRegenerate}
              onFeedback={handleFeedback}
            />
          </div>
        )}

        {/* Follow-up chips */}
        {message.role === "assistant" &&
          !message.isStreaming &&
          message.followUpSuggestions?.length ? (
          <FollowUpChips
            suggestions={message.followUpSuggestions}
            disabled={isLoading}
            onSelect={(value) => onQuickReply(value)}
          />
        ) : null}
      </div>
    </div>
  );
}
