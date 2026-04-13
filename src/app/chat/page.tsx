"use client";

export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { useHealthStatus } from "@/lib/hooks/use-health-status";
import { type TraceEvent, type ThinkingEvent } from "@/components/chat/agent-trace";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ChatMessageRow } from "@/components/chat/chat-message-row";
import { ArtifactPanel, type ArtifactData } from "@/components/chat/artifact-panel";
import { SaveToDocModal } from "@/components/chat/save-to-doc-modal";
import { DocAttachPicker, AttachedDocChips, type AttachedDoc } from "@/components/chat/doc-attach-picker";
import { FirstRunSetup, type FirstRunSetupValues } from "@/components/chat/first-run-setup";
import { WelcomeHome } from "@/components/chat/welcome-home";
import type { WelcomeStarterAction } from "@/components/chat/welcome-starter-actions";
import type { TaskPlan, UserSettings } from "@/lib/types/database";
import type { ChatCard } from "@/lib/types/cards";
import type { StreamingSegment } from "@/components/chat/streaming-message";
import {
  detectPreferredLocale,
  normalizeLocale,
  setLocaleCookie,
  toLocaleLanguageTag,
  type AppLocale,
} from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Calendar, FileText, Lightbulb, LayoutDashboard, LogOut, Search, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback, useMemo, type MutableRefObject } from "react";

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

interface RecentRunSummary {
  id: string;
  input_preview: string | null;
  source: string;
  status: string;
  started_at: string;
}

interface HomeDocumentSummary {
  id: string;
  title: string;
  folder: string | null;
  content: string;
  preview: string;
  updated_at: string;
}

interface HomeTaskSummary {
  id: string;
  description: string;
  enabled: boolean;
  next_run_at: string | null;
}

interface ChatLocaleCopy {
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  greetingFallbackName: string;
  defaultWelcomeSubtitle: string;
  welcomeReadyPrefix: string;
  styleDecisionFirst: string;
  styleContextFirst: string;
  styleMorningDeepWork: string;
  styleAfternoonDeepWork: string;
  styleFlexibleWorkRhythm: string;
  workspaceReady: string;
  welcomeContinueLastWorkspace: string;
  actionContinue: string;
  actionOpenChat: string;
  actionOpen: string;
  updatedPrefix: string;
  viewDocs: string;
  viewTasks: string;
  inputPlaceholder: string;
  inputHint: string;
  loadingEarlierMessages: string;
  loading: string;
  statusPrefix: string;
  statusOnline: string;
  statusFallback: string;
  statusConnecting: string;
  statusOffline: string;
  openDocsAria: string;
  docsLabel: string;
  openSettingsAria: string;
  settingsLabel: string;
  signOutAria: string;
  signOutLabel: string;
  responseTitle: string;
  defaultErrorMessage: string;
  connectionErrorMessage: string;
  interruptedMessage: string;
  starterPlanMyDayLabel: string;
  starterPlanMyDayPrompt: string;
  starterResearchTopicLabel: string;
  starterResearchTopicPrompt: string;
  starterCreateRoadmapLabel: string;
  starterCreateRoadmapPrompt: string;
  starterThinkItThroughLabel: string;
  starterThinkItThroughPrompt: string;
}

const CHAT_COPY: Record<AppLocale, ChatLocaleCopy> = {
  en: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    greetingFallbackName: "there",
    defaultWelcomeSubtitle: "What do you want to move forward today?",
    welcomeReadyPrefix: "Ready to work in your style:",
    styleDecisionFirst: "decision-first",
    styleContextFirst: "context-first",
    styleMorningDeepWork: "morning deep work",
    styleAfternoonDeepWork: "afternoon deep work",
    styleFlexibleWorkRhythm: "a flexible work rhythm",
    workspaceReady: "Your workspace is ready.",
    welcomeContinueLastWorkspace: "Continue your last workspace",
    actionContinue: "Continue",
    actionOpenChat: "Open chat",
    actionOpen: "Open",
    updatedPrefix: "Updated",
    viewDocs: "View docs",
    viewTasks: "View tasks",
    inputPlaceholder: "Message Hada...",
    inputHint:
      "Enter to send, Shift+Enter for a new line. Hada can make mistakes — verify important information.",
    loadingEarlierMessages: "Loading earlier messages...",
    loading: "Loading...",
    statusPrefix: "Status",
    statusOnline: "Online",
    statusFallback: "Fallback",
    statusConnecting: "Connecting",
    statusOffline: "Offline",
    openDocsAria: "Open docs",
    docsLabel: "Docs",
    openSettingsAria: "Open settings",
    settingsLabel: "Settings",
    signOutAria: "Sign out",
    signOutLabel: "Sign out",
    responseTitle: "Response",
    defaultErrorMessage: "Sorry, I encountered an error.",
    connectionErrorMessage: "Sorry, I'm having trouble connecting. Please try again.",
    interruptedMessage: "Response interrupted before completion. Please try again.",
    starterPlanMyDayLabel: "Plan My Day",
    starterPlanMyDayPrompt:
      "Review my calendar and tasks for today. Give me a practical day plan with top priorities, conflict warnings, and the best deep-work block to protect before 3 PM.",
    starterResearchTopicLabel: "Research A Topic",
    starterResearchTopicPrompt:
      "Help me research a topic. First ask what topic I want to investigate, then use current sources and produce a concise source-backed brief with what matters most.",
    starterCreateRoadmapLabel: "Create Roadmap",
    starterCreateRoadmapPrompt:
      "Help me create a project roadmap. First ask what project I want to start, then research the space, create a roadmap document in the workspace, and give me a short execution summary in chat.",
    starterThinkItThroughLabel: "Think It Through",
    starterThinkItThroughPrompt:
      "I have something I need to think through. Ask me what's on my mind, then help me examine it from multiple angles — assumptions, risks, and what a good decision actually looks like — and land on a clear next step.",
  },
  ko: {
    greetingMorning: "좋은 아침입니다",
    greetingAfternoon: "좋은 오후입니다",
    greetingEvening: "좋은 저녁입니다",
    greetingFallbackName: "거기",
    defaultWelcomeSubtitle: "오늘 무엇을 먼저 진행할까요?",
    welcomeReadyPrefix: "당신의 스타일에 맞춰 준비됐어요:",
    styleDecisionFirst: "결론 우선",
    styleContextFirst: "맥락 우선",
    styleMorningDeepWork: "오전 집중 근무",
    styleAfternoonDeepWork: "오후 집중 근무",
    styleFlexibleWorkRhythm: "유연한 작업 리듬",
    workspaceReady: "워크스페이스가 준비되었습니다.",
    welcomeContinueLastWorkspace: "지난 작업 계속하기",
    actionContinue: "계속",
    actionOpenChat: "채팅 열기",
    actionOpen: "열기",
    updatedPrefix: "업데이트",
    viewDocs: "문서 보기",
    viewTasks: "작업 보기",
    inputPlaceholder: "Hada에게 메시지 보내기...",
    inputHint:
      "Enter로 전송하고 Shift+Enter로 줄바꿈하세요. Hada는 실수할 수 있으니 중요한 정보는 확인하세요.",
    loadingEarlierMessages: "이전 메시지를 불러오는 중...",
    loading: "불러오는 중...",
    statusPrefix: "상태",
    statusOnline: "온라인",
    statusFallback: "대체 경로",
    statusConnecting: "연결 중",
    statusOffline: "오프라인",
    openDocsAria: "문서 열기",
    docsLabel: "문서",
    openSettingsAria: "설정 열기",
    settingsLabel: "설정",
    signOutAria: "로그아웃",
    signOutLabel: "로그아웃",
    responseTitle: "응답",
    defaultErrorMessage: "죄송합니다. 오류가 발생했습니다.",
    connectionErrorMessage: "죄송합니다. 연결에 문제가 있습니다. 다시 시도해 주세요.",
    interruptedMessage: "응답이 완료되기 전에 중단되었습니다. 다시 시도해 주세요.",
    starterPlanMyDayLabel: "오늘 일정 계획",
    starterPlanMyDayPrompt:
      "오늘의 일정과 작업을 검토해 주세요. 최우선 순위, 충돌 가능성, 그리고 오후 3시 이전에 보호할 최적의 집중 업무 시간을 포함한 실용적인 하루 계획을 만들어 주세요.",
    starterResearchTopicLabel: "주제 리서치",
    starterResearchTopicPrompt:
      "특정 주제를 리서치하고 싶어요. 먼저 어떤 주제를 조사할지 물어보고, 최신 소스를 활용해 핵심만 담긴 간결한 근거 기반 브리프를 만들어 주세요.",
    starterCreateRoadmapLabel: "로드맵 만들기",
    starterCreateRoadmapPrompt:
      "프로젝트 로드맵을 만들고 싶어요. 먼저 어떤 프로젝트를 시작할지 물어본 뒤, 관련 내용을 조사하고 워크스페이스에 로드맵 문서를 생성한 다음, 채팅에 짧은 실행 요약을 남겨 주세요.",
    starterThinkItThroughLabel: "생각 정리하기",
    starterThinkItThroughPrompt:
      "정리하고 싶은 고민이 있어요. 먼저 무엇을 고민 중인지 물어보고, 가정과 리스크, 좋은 결정의 기준 등 여러 관점에서 함께 검토한 뒤 명확한 다음 단계까지 도출해 주세요.",
  },
  ja: {
    greetingMorning: "おはようございます",
    greetingAfternoon: "こんにちは",
    greetingEvening: "こんばんは",
    greetingFallbackName: "そこ",
    defaultWelcomeSubtitle: "今日は何を前に進めますか？",
    welcomeReadyPrefix: "あなたのスタイルで進める準備ができています:",
    styleDecisionFirst: "結論先行",
    styleContextFirst: "背景先行",
    styleMorningDeepWork: "午前の集中作業",
    styleAfternoonDeepWork: "午後の集中作業",
    styleFlexibleWorkRhythm: "柔軟な作業リズム",
    workspaceReady: "ワークスペースの準備ができました。",
    welcomeContinueLastWorkspace: "前回の作業を続ける",
    actionContinue: "続ける",
    actionOpenChat: "チャットを開く",
    actionOpen: "開く",
    updatedPrefix: "更新",
    viewDocs: "ドキュメントを見る",
    viewTasks: "タスクを見る",
    inputPlaceholder: "Hada にメッセージ...",
    inputHint:
      "Enter で送信、Shift+Enter で改行できます。Hada は誤る可能性があるため、重要な情報は確認してください。",
    loadingEarlierMessages: "以前のメッセージを読み込み中...",
    loading: "読み込み中...",
    statusPrefix: "ステータス",
    statusOnline: "オンライン",
    statusFallback: "フォールバック",
    statusConnecting: "接続中",
    statusOffline: "オフライン",
    openDocsAria: "ドキュメントを開く",
    docsLabel: "ドキュメント",
    openSettingsAria: "設定を開く",
    settingsLabel: "設定",
    signOutAria: "サインアウト",
    signOutLabel: "サインアウト",
    responseTitle: "応答",
    defaultErrorMessage: "申し訳ありません。エラーが発生しました。",
    connectionErrorMessage: "接続に問題があります。もう一度お試しください。",
    interruptedMessage: "応答が完了前に中断されました。もう一度お試しください。",
    starterPlanMyDayLabel: "今日の計画",
    starterPlanMyDayPrompt:
      "今日のカレンダーとタスクを確認してください。優先順位、競合リスク、15時までに確保すべき最適な集中時間を含む実用的な1日の計画を作ってください。",
    starterResearchTopicLabel: "トピック調査",
    starterResearchTopicPrompt:
      "あるテーマを調査したいです。まず何を調べるか確認し、最新ソースを使って重要点を押さえた簡潔な根拠付きブリーフを作成してください。",
    starterCreateRoadmapLabel: "ロードマップ作成",
    starterCreateRoadmapPrompt:
      "プロジェクトのロードマップを作りたいです。まず開始したいプロジェクトを確認し、関連情報を調査してワークスペースにロードマップ文書を作成し、チャットで短い実行サマリーをください。",
    starterThinkItThroughLabel: "考えを整理",
    starterThinkItThroughPrompt:
      "考えを整理したいテーマがあります。まず何について考えているかを聞き、前提・リスク・良い意思決定の基準など複数の観点で整理して、次の一手を明確にしてください。",
  },
  zh: {
    greetingMorning: "早上好",
    greetingAfternoon: "下午好",
    greetingEvening: "晚上好",
    greetingFallbackName: "你好",
    defaultWelcomeSubtitle: "你今天想推进什么？",
    welcomeReadyPrefix: "已按你的风格准备好：",
    styleDecisionFirst: "先给结论",
    styleContextFirst: "先讲背景",
    styleMorningDeepWork: "上午深度工作",
    styleAfternoonDeepWork: "下午深度工作",
    styleFlexibleWorkRhythm: "灵活的工作节奏",
    workspaceReady: "你的工作区已准备就绪。",
    welcomeContinueLastWorkspace: "继续上次的工作区",
    actionContinue: "继续",
    actionOpenChat: "打开聊天",
    actionOpen: "打开",
    updatedPrefix: "更新于",
    viewDocs: "查看文档",
    viewTasks: "查看任务",
    inputPlaceholder: "给 Hada 发消息...",
    inputHint:
      "按 Enter 发送，Shift+Enter 换行。Hada 也会出错，重要信息请自行核实。",
    loadingEarlierMessages: "正在加载更早的消息...",
    loading: "加载中...",
    statusPrefix: "状态",
    statusOnline: "在线",
    statusFallback: "备用",
    statusConnecting: "连接中",
    statusOffline: "离线",
    openDocsAria: "打开文档",
    docsLabel: "文档",
    openSettingsAria: "打开设置",
    settingsLabel: "设置",
    signOutAria: "退出登录",
    signOutLabel: "退出登录",
    responseTitle: "回复",
    defaultErrorMessage: "抱歉，发生了错误。",
    connectionErrorMessage: "抱歉，连接出现问题。请再试一次。",
    interruptedMessage: "回复在完成前被中断了。请再试一次。",
    starterPlanMyDayLabel: "规划今天",
    starterPlanMyDayPrompt:
      "查看我今天的日历和任务。给我一个务实的日程安排，包含最高优先级、冲突提醒，以及下午 3 点前最值得保护的深度工作时段。",
    starterResearchTopicLabel: "研究一个主题",
    starterResearchTopicPrompt:
      "帮我研究一个主题。先问我想研究什么，然后使用最新资料，整理一份简洁、带来源依据的重点摘要。",
    starterCreateRoadmapLabel: "创建路线图",
    starterCreateRoadmapPrompt:
      "帮我制定一个项目路线图。先问我想启动什么项目，然后调研相关领域，在工作区创建路线图文档，并在聊天里给我一个简短执行摘要。",
    starterThinkItThroughLabel: "理清思路",
    starterThinkItThroughPrompt:
      "我有件事想想清楚。先问我在思考什么，然后从假设、风险、以及怎样才算好决策等多个角度帮我梳理，最后收敛到一个明确的下一步。",
  },
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string; id?: string } | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);
  const [greetingText, setGreetingText] = useState("Hello");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [recentRuns, setRecentRuns] = useState<RecentRunSummary[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<HomeDocumentSummary[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<HomeTaskSummary[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [artifactContent, setArtifactContent] = useState<ArtifactData | null>(null);
  const [saveModalContent, setSaveModalContent] = useState<string | null>(null);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventOrderRef = useRef(0);
  const backgroundJobPollersRef = useRef(new Map<string, number>());
  const backgroundJobCursorRef = useRef(new Map<string, number>());
  const pendingResponsePollRef = useRef<number | null>(null);
  // Token drain queue: buffer text_delta tokens and release at a steady pace to smooth
  // out network bursts (TCP delivers batches of tokens at once → visually choppy).
  const pendingTokensRef = useRef<Map<string, string>>(new Map());
  const drainRafRef = useRef<number | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { status: connectionStatus } = useHealthStatus(30000); // Poll every 30s
  const locale = useMemo(() => normalizeLocale(userSettings?.locale), [userSettings]);
  const copy = CHAT_COPY[locale];
  const localeTag = toLocaleLanguageTag(locale);

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

  const updateMessage = useCallback(
    (messageId: string, updater: (message: Message) => Message) => {
      let updated: Message[] = [];
      setMessages((prev) => {
        updated = prev.map((message) => (message.id === messageId ? updater(message) : message));
        return updated;
      });
      return updated;
    },
    [],
  );

  // Drain up to N chars per animation frame so fast bursts render smoothly.
  const DRAIN_CHARS_PER_FRAME = 16;
  const startDrainLoop = useCallback(() => {
    if (drainRafRef.current !== null) return;
    const drain = () => {
      const queue = pendingTokensRef.current;
      if (queue.size === 0) {
        drainRafRef.current = null;
        return;
      }
      const updates = new Map<string, string>();
      for (const [msgId, pending] of queue.entries()) {
        const chunk = pending.slice(0, DRAIN_CHARS_PER_FRAME);
        const remaining = pending.slice(DRAIN_CHARS_PER_FRAME);
        updates.set(msgId, chunk);
        if (remaining) {
          queue.set(msgId, remaining);
        } else {
          queue.delete(msgId);
        }
      }
      setMessages((prev) =>
        prev.map((msg) => {
          const chunk = updates.get(msg.id);
          return chunk ? { ...msg, content: msg.content + chunk } : msg;
        }),
      );
      drainRafRef.current = requestAnimationFrame(drain);
    };
    drainRafRef.current = requestAnimationFrame(drain);
  }, []);

  const stopBackgroundJobPolling = useCallback((jobId: string) => {
    const poller = backgroundJobPollersRef.current.get(jobId);
    if (poller != null) {
      window.clearInterval(poller);
      backgroundJobPollersRef.current.delete(jobId);
    }
  }, []);

  const loadDocumentArtifact = useCallback(
    async (documentId: string, fallbackTitle?: string, fallbackContent?: string) => {
      setArtifactContent({
        id: documentId,
        type: "document",
        title: fallbackTitle || "Document",
        content: fallbackContent,
        loading: true,
        statusText: "Opening document",
      });

      try {
        const { data, error } = await supabase
          .from("documents")
          .select("id, title, content")
          .eq("id", documentId)
          .single();

        if (error || !data) {
          throw error || new Error("Document not found.");
        }

        setArtifactContent({
          id: data.id,
          type: "document",
          title: data.title || fallbackTitle || "Document",
          content: typeof data.content === "string" ? data.content : fallbackContent,
        });
      } catch (error) {
        console.error("Failed to load artifact document", error);
        setArtifactContent({
          id: documentId,
          type: "document",
          title: fallbackTitle || "Document",
          content: fallbackContent || "Unable to load the document preview. Open Full View to inspect it.",
        });
      }
    },
    [supabase],
  );

  const applyAgentEventToMessage = useCallback((assistantMessageId: string, event: Record<string, unknown>) => {
    if (event.type === "text_delta" && typeof event.content === "string") {
      setIsThinking(false);
      const existing = pendingTokensRef.current.get(assistantMessageId) ?? "";
      pendingTokensRef.current.set(assistantMessageId, existing + event.content);
      startDrainLoop();
      return;
    }

    if (event.type === "tool_call") {
      setIsThinking(true);
      const order = nextEventOrder(eventOrderRef);
      const callId = typeof event.callId === "string" ? event.callId : `call_${Date.now()}`;
      const name = typeof event.name === "string" ? event.name : "unknown";
      const args = (event.args && typeof event.args === "object") ? event.args as Record<string, unknown> : {};

      if (name === "create_document" || name === "update_document") {
        const pendingDocumentId = typeof args.id === "string" ? args.id : undefined;
        const pendingTitle = typeof args.title === "string" && args.title.trim()
          ? args.title.trim()
          : "Document";

        setArtifactContent({
          id: pendingDocumentId,
          type: "document",
          title: pendingTitle,
          loading: true,
          statusText: name === "create_document"
            ? "Writing document"
            : "Updating document",
        });
      }

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

      const updatedMessages = updateMessage(assistantMessageId, (message) => ({
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

      // Automatically open ArtifactPanel for document creation/update
      try {
        const parsed = JSON.parse(result);
        if ((parsed.status === "created" || parsed.status === "updated") && typeof parsed.id === "string") {
          const assistantMsg = updatedMessages.find((m) => m.id === assistantMessageId);
          const trace = assistantMsg?.traceEvents?.find((t) => t.callId === callId);
          const content = typeof trace?.args?.content === "string" ? trace.args.content : undefined;

          void loadDocumentArtifact(
            parsed.id,
            typeof parsed.title === "string" ? parsed.title : undefined,
            content,
          );
        }
      } catch {
        // Not a JSON result or doesn't match our document tools
      }
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
        content: String(event.message ?? copy.defaultErrorMessage),
        isStreaming: false,
        isError: true,
      }));
    }
  }, [copy.defaultErrorMessage, loadDocumentArtifact, updateMessage, startDrainLoop]);

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

  const loadHistory = useCallback(async (before?: string): Promise<Message[] | undefined> => {
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
        // Initial load — keep landing view even when history exists.
        setMessages(loadedMessages);
      }

      setHasMoreHistory(data.hasMore);
      return loadedMessages;
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
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, name, email, settings")
        .single();

      if (!dbUser) {
        router.push("/auth/login");
        return;
      }

      const dbName = (dbUser as { name?: string | null }).name;
      const settings = ((dbUser as { settings?: UserSettings }).settings || {}) as UserSettings;

      setUser({ email: dbUser.email, name: dbName ?? undefined, id: dbUser.id });
      let nextSettings = settings;
      let shouldPersistSettings = false;

      // Auto-detect and save locale for first-time users.
      const detectedLocale = detectPreferredLocale(
        typeof navigator !== "undefined" ? navigator.languages : undefined,
      );
      if (typeof settings.locale !== "string" && detectedLocale !== "en") {
        nextSettings = { ...nextSettings, locale: detectedLocale };
        shouldPersistSettings = true;
      }
      setLocaleCookie(normalizeLocale(nextSettings.locale));

      // Auto-detect and silently save timezone if not set.
      if (!nextSettings.timezone) {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTimezone) {
          nextSettings = { ...nextSettings, timezone: detectedTimezone };
          shouldPersistSettings = true;
        }
      }

      if (shouldPersistSettings) {
        await supabase
          .from("users")
          .update({ settings: nextSettings })
          .eq("id", dbUser.id);
      }

      setUserSettings(nextSettings);
      setShowFirstRunSetup(nextSettings.onboarding_completed !== true);

      // Load message history + home surface data in parallel.
      const [initialMessages] = await Promise.all([
        loadHistory(),
        fetch("/api/dashboard/activity?limit=3", { cache: "no-store" })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => {
            if (!d) return;
            const runs = Array.isArray(d?.runs) ? d.runs : [];
            setRecentRuns(runs);
          })
          .catch(() => null),
        fetch("/api/documents", { cache: "no-store" })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => {
            const documents = Array.isArray(d?.documents) ? d.documents : [];
            setRecentDocuments(documents);
          })
          .catch(() => null),
        fetch("/api/dashboard/tasks", { cache: "no-store" })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => {
            const tasks = Array.isArray(d?.tasks) ? (d.tasks as unknown[]) : [];
            const sortedTasks = tasks
              .filter((task: unknown): task is HomeTaskSummary => !!task && typeof task === "object" && typeof (task as { id?: unknown }).id === "string")
              .sort((a, b) => {
                const aTime = a.next_run_at ? new Date(a.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
                const bTime = b.next_run_at ? new Date(b.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
                return aTime - bTime;
              });
            setUpcomingTasks(sortedTasks);
          })
          .catch(() => null),
      ]);
      setIsLoadingHistory(false);

      // If the last message is from the user with no assistant reply, the server may
      // still be processing. Show a streaming placeholder and poll until the response lands.
      if (initialMessages && initialMessages.length > 0) {
        const lastMsg = initialMessages[initialMessages.length - 1];
        if (lastMsg.role === "user") {
          const placeholderId = `pending-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            { id: placeholderId, role: "assistant", content: "", isStreaming: true, created_at: new Date().toISOString() },
          ]);
          setIsLoading(true);

          const pollForResponse = () => {
            pendingResponsePollRef.current = window.setTimeout(async () => {
              try {
                const res = await fetch("/api/conversations/messages?limit=10");
                if (!res.ok) return;
                const data = await res.json() as { messages: ApiMessage[] };
                const latest: Message[] = data.messages.map(apiMessageToMessage);
                const hasReply = latest.some((m) => m.role === "assistant");
                if (hasReply) {
                  setMessages(latest);
                  setIsLoading(false);
                  pendingResponsePollRef.current = null;
                } else {
                  pollForResponse();
                }
              } catch {
                pollForResponse();
              }
            }, 3000);
          };
          pollForResponse();
        }
      }
    };
    initialize();
  }, [router, supabase, loadHistory]);

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
      if (pendingResponsePollRef.current !== null) {
        window.clearTimeout(pendingResponsePollRef.current);
      }
      if (drainRafRef.current !== null) {
        cancelAnimationFrame(drainRafRef.current);
      }
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
        // Flush any buffered tokens before applying the terminal state.
        pendingTokensRef.current.delete(currentAssistantId);
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
        pendingTokensRef.current.delete(currentAssistantId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantId
              ? {
                  ...msg,
                  content: String(event.message ?? copy.defaultErrorMessage),
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
                  ? `${msg.content}\n\n${copy.interruptedMessage}`
                  : copy.interruptedMessage,
                isStreaming: false,
                isError: true,
                streamSegments: undefined,
              }
            : msg,
        ),
      );
    }

    return currentAssistantId;
  }, [applyAgentEventToMessage, copy.defaultErrorMessage, copy.interruptedMessage, ensureBackgroundJobPolling]);

  const handleSaveToDoc = (_messageId: string, content: string) => {
    setSaveModalContent(content);
  };

  const handleOpenArtifact = (_messageId: string, content: string) => {
    const titleMatch = content.match(/^#{1,3}\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : copy.responseTitle;
    setArtifactContent({ title, content, type: "response" });
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
                  : copy.connectionErrorMessage,
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
          : copy.connectionErrorMessage,
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

  const handleDeleteMessage = async (messageId: string) => {
    // Find the user message immediately before this assistant message.
    let precedingUserMessageId: string | null = null;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx > 0 && prev[idx - 1].role === "user") {
        precedingUserMessageId = prev[idx - 1].id;
      }
      return prev.filter((m) => m.id !== messageId && m.id !== precedingUserMessageId);
    });
    try {
      const toDelete = [messageId, precedingUserMessageId].filter(Boolean) as string[];
      await Promise.all(
        toDelete.map((id) => fetch(`/api/conversations/messages/${id}`, { method: "DELETE" })),
      );
    } catch (error) {
      console.error("Delete message error:", error);
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
      setGreetingText(copy.greetingMorning);
    } else if (hour < 18) {
      setGreetingText(copy.greetingAfternoon);
    } else {
      setGreetingText(copy.greetingEvening);
    }
  }, [copy.greetingAfternoon, copy.greetingEvening, copy.greetingMorning]);

  const shouldShowLanding = !showConversation;
  const hasLastChat = messages.length > 0 || recentRuns.length > 0;

  const handleOpenDocumentWorkspace = (document: HomeDocumentSummary) => {
    setArtifactContent({
      id: document.id,
      title: document.title,
      content: document.content,
      type: "document",
    });
    setShowConversation(true);
  };

  const handleContinueLastChat = async () => {
    if (!messages.length) {
      await loadHistory();
    }
    setShowConversation(true);
  };

  const handleStarterAction = (prompt: string) => {
    void sendMessage(prompt);
  };

  const handleFirstRunComplete = async (values: FirstRunSetupValues) => {
    if (!user?.id) {
      return;
    }

    const nextSettings: UserSettings = {
      ...(userSettings || {}),
      onboarding_completed: true,
      persona: values.remember.assistantVoice ? mapAssistantVoiceToPersona(values.assistantVoice) : userSettings?.persona,
      working_style: {
        writing_style: values.remember.workingStyle ? values.writingStyle : undefined,
        recommendation_style: values.remember.recommendationStyle ? values.recommendationStyle : undefined,
        planning_style: values.remember.planningStyle ? values.planningStyle : undefined,
        work_rhythm: values.remember.workRhythm ? values.workRhythm : undefined,
      },
      assistant_preferences: {
        primary_goals: values.remember.primaryGoals ? values.primaryGoals : [],
        calendar_habits: values.remember.calendarHabits ? values.calendarHabits : [],
        current_projects: values.remember.currentProjects ? values.currentProjects : [],
        voice: values.remember.assistantVoice ? values.assistantVoice : undefined,
        setup_version: 1,
      },
    };

    const { error } = await supabase
      .from("users")
      .update({ settings: nextSettings })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to save onboarding settings:", error);
      return;
    }

    setUserSettings(nextSettings);
    setShowFirstRunSetup(false);
  };

  const handleFirstRunSkip = async () => {
    if (!user?.id) {
      return;
    }

    const nextSettings: UserSettings = {
      ...(userSettings || {}),
      onboarding_completed: true,
    };

    const { error } = await supabase
      .from("users")
      .update({ settings: nextSettings })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to skip onboarding:", error);
      return;
    }

    setUserSettings(nextSettings);
    setShowFirstRunSetup(false);
  };

  const welcomeGreeting = `${greetingText}, ${user?.name || copy.greetingFallbackName}`;
  const welcomeSubtitle = buildWelcomeSubtitle(userSettings, copy);
  const latestDocument = recentDocuments[0];
  const dueTodayCount = upcomingTasks.filter((task) => isTaskDueToday(task.next_run_at)).length;
  const welcomeStatusText = buildWelcomeStatusText(recentDocuments.length, dueTodayCount, locale, copy);
  const welcomeStarterActions: WelcomeStarterAction[] = [
    {
      id: "plan-my-day",
      label: copy.starterPlanMyDayLabel,
      icon: <Calendar className="h-4 w-4" />,
      onClick: () => handleStarterAction(copy.starterPlanMyDayPrompt),
    },
    {
      id: "research-topic",
      label: copy.starterResearchTopicLabel,
      icon: <Search className="h-4 w-4" />,
      onClick: () => handleStarterAction(copy.starterResearchTopicPrompt),
    },
    {
      id: "create-roadmap",
      label: copy.starterCreateRoadmapLabel,
      icon: <FileText className="h-4 w-4" />,
      onClick: () => handleStarterAction(copy.starterCreateRoadmapPrompt),
    },
    {
      id: "think-it-through",
      label: copy.starterThinkItThroughLabel,
      icon: <Lightbulb className="h-4 w-4" />,
      onClick: () => handleStarterAction(copy.starterThinkItThroughPrompt),
    },
  ];
  const welcomeContinueRow = latestDocument && !hasLastChat
    ? {
        label: latestDocument.title,
        description: `${copy.updatedPrefix} ${formatShortDate(latestDocument.updated_at, localeTag)}`,
        actionLabel: copy.actionOpen,
        onContinue: () => handleOpenDocumentWorkspace(latestDocument),
      }
    : {
        label:
          [...messages].reverse().find((m) => m.role === "user")?.content?.slice(0, 80) ||
          copy.welcomeContinueLastWorkspace,
        actionLabel: hasLastChat ? copy.actionContinue : copy.actionOpenChat,
        onContinue: () => {
          if (hasLastChat) {
            void handleContinueLastChat();
            return;
          }
          setShowConversation(true);
        },
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
          placeholder={copy.inputPlaceholder}
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
        {copy.inputHint}
      </p>
    </form>
  );

  const hasProcessedQuery = useRef(false);
  useEffect(() => {
    if (hasProcessedQuery.current || isLoadingHistory || isLoading || showFirstRunSetup) return;
    
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const draft = url.searchParams.get("draft");
      const q = url.searchParams.get("q");
      if (draft) {
        hasProcessedQuery.current = true;
        url.searchParams.delete("draft");
        window.history.replaceState({}, document.title, url.toString());
        setInput(draft);
        textareaRef.current?.focus();
        return;
      }
      if (q) {
        hasProcessedQuery.current = true;
        url.searchParams.delete("q");
        window.history.replaceState({}, document.title, url.toString());
        // Small delay to ensure state and DOM are settled
        setTimeout(() => {
          void sendMessage(q);
        }, 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingHistory, isLoading, showFirstRunSetup]);

  return (
    <div lang={localeTag} className="fixed inset-0 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}

      <header className="border-b border-zinc-200/80 bg-white/80 px-3 py-3 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/80 sm:px-4">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden shadow-md shadow-teal-500/20">
              <Image src="/hada-logo.png" alt="Hada" width={24} height={24} className="h-6 w-6 object-cover" />
            </div>
            <span className="truncate font-semibold">Hada</span>
            <Link
              href="/settings"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/70 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-600 dark:border-zinc-800/70 dark:hover:text-zinc-300 sm:text-xs"
              title={`${copy.statusPrefix}: ${getConnectionStatusLabel(connectionStatus, copy)}`}
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
                {connectionStatus === "connected" && copy.statusOnline}
                {connectionStatus === "degraded" && copy.statusFallback}
                {connectionStatus === "connecting" && copy.statusConnecting}
                {connectionStatus === "disconnected" && copy.statusOffline}
              </span>
            </Link>
          </div>
          <div className="flex items-center justify-end gap-1 sm:gap-1.5">
            <span className="hidden text-sm text-muted-foreground xl:block">{user?.email}</span>
            <ThemeToggle />

            <Link href="/docs" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label={copy.openDocsAria}>
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/docs" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="px-2.5">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                {copy.docsLabel}
              </Button>
            </Link>

            <Link href="/settings" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label={copy.openSettingsAria}>
                <Settings2 className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/settings" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="px-2.5">
                <Settings2 className="mr-2 h-4 w-4" />
                {copy.settingsLabel}
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label={copy.signOutAria}
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="sm" className="hidden px-2.5 sm:inline-flex" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {copy.signOutLabel}
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
                    <span className="text-sm text-zinc-400">{copy.loadingEarlierMessages}</span>
                  </div>
                )}
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <span className="text-sm text-zinc-400">{copy.loading}</span>
                  </div>
                ) : shouldShowLanding ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex min-h-full w-full min-w-0 flex-col items-center justify-start overflow-x-hidden px-4 pb-8 pt-5 sm:min-h-[60vh] sm:justify-center sm:px-4 sm:pb-10 sm:pt-6"
                  >
                    {showFirstRunSetup ? (
                      <FirstRunSetup
                        className="w-full max-w-4xl"
                        initialValues={buildInitialSetupValues(userSettings)}
                        onComplete={(values) => void handleFirstRunComplete(values)}
                        onSkip={() => void handleFirstRunSkip()}
                      />
                    ) : (
                      <div className="w-full max-w-4xl">
                        <WelcomeHome
                          greeting={welcomeGreeting}
                          subtitle={welcomeSubtitle}
                          starterActions={welcomeStarterActions}
                          continueRow={welcomeContinueRow}
                          statusLine={{
                            text: welcomeStatusText,
                            actionLabel:
                              recentDocuments.length > 0
                                ? copy.viewDocs
                                : dueTodayCount > 0
                                ? copy.viewTasks
                                : undefined,
                            onAction: recentDocuments.length > 0
                              ? () => router.push("/docs")
                              : dueTodayCount > 0
                              ? () => router.push("/settings?tab=tasks")
                              : undefined,
                          }}
                        />

                        <div className="mx-auto mt-8 w-full max-w-xl sm:mt-10">
                          {inputForm}
                        </div>
                      </div>
                    )}
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
                          onDelete={handleDeleteMessage}
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
          {showConversation && (
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
                artifact={artifactContent}
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

function buildInitialSetupValues(settings: UserSettings | null): Partial<FirstRunSetupValues> | undefined {
  if (!settings) {
    return undefined;
  }

  return {
    writingStyle: settings.working_style?.writing_style,
    recommendationStyle: settings.working_style?.recommendation_style,
    planningStyle: settings.working_style?.planning_style,
    workRhythm: settings.working_style?.work_rhythm,
    primaryGoals: settings.assistant_preferences?.primary_goals,
    calendarHabits: settings.assistant_preferences?.calendar_habits,
    currentProjects: settings.assistant_preferences?.current_projects,
    assistantVoice: settings.assistant_preferences?.voice,
  };
}

function mapAssistantVoiceToPersona(voice: FirstRunSetupValues["assistantVoice"]): string {
  switch (voice) {
    case "friendly":
      return "friendly";
    case "professional":
      return "professional";
    case "academic":
      return "academic";
    case "pragmatic":
    default:
      return "concise";
  }
}

function buildWelcomeSubtitle(settings: UserSettings | null, copy: ChatLocaleCopy): string {
  const writingStyle = settings?.working_style?.writing_style;
  const recommendationStyle = settings?.working_style?.recommendation_style;
  const workRhythm = settings?.working_style?.work_rhythm;

  if (!writingStyle && !recommendationStyle && !workRhythm) {
    return copy.defaultWelcomeSubtitle;
  }

  const parts: string[] = [];
  if (writingStyle) {
    parts.push(formatWritingStyleLabel(writingStyle, normalizeLocale(settings?.locale)));
  }
  if (recommendationStyle) {
    parts.push(recommendationStyle === "decision_first" ? copy.styleDecisionFirst : copy.styleContextFirst);
  }
  if (workRhythm) {
    parts.push(
      workRhythm === "morning_deep_work"
        ? copy.styleMorningDeepWork
        : workRhythm === "afternoon_deep_work"
        ? copy.styleAfternoonDeepWork
        : copy.styleFlexibleWorkRhythm,
    );
  }

  return `${copy.welcomeReadyPrefix} ${parts.join(", ")}.`;
}

function buildWelcomeStatusText(
  documentCount: number,
  dueTodayCount: number,
  locale: AppLocale,
  copy: ChatLocaleCopy,
): string {
  if (documentCount > 0 && dueTodayCount > 0) {
    return buildDocAndReviewStatusText(documentCount, dueTodayCount, locale);
  }
  if (documentCount > 0) {
    return buildDocAndReviewStatusText(documentCount, 0, locale);
  }
  if (dueTodayCount > 0) {
    return buildDocAndReviewStatusText(0, dueTodayCount, locale);
  }
  return copy.workspaceReady;
}

function buildDocAndReviewStatusText(documentCount: number, dueTodayCount: number, locale: AppLocale): string {
  if (locale === "ko") {
    if (documentCount > 0 && dueTodayCount > 0) {
      return `진행 중인 문서 ${documentCount}개 • 오늘 검토 ${dueTodayCount}건`;
    }
    if (documentCount > 0) {
      return `진행 중인 문서 ${documentCount}개`;
    }
    return `오늘 검토 ${dueTodayCount}건`;
  }

  if (locale === "ja") {
    if (documentCount > 0 && dueTodayCount > 0) {
      return `進行中ドキュメント ${documentCount} 件 • 本日レビュー ${dueTodayCount} 件`;
    }
    if (documentCount > 0) {
      return `進行中ドキュメント ${documentCount} 件`;
    }
    return `本日レビュー ${dueTodayCount} 件`;
  }

  if (locale === "zh") {
    if (documentCount > 0 && dueTodayCount > 0) {
      return `进行中的文档 ${documentCount} 份 • 今天待复查 ${dueTodayCount} 项`;
    }
    if (documentCount > 0) {
      return `进行中的文档 ${documentCount} 份`;
    }
    return `今天待复查 ${dueTodayCount} 项`;
  }

  if (documentCount > 0 && dueTodayCount > 0) {
    return `${documentCount} docs in progress • ${dueTodayCount} review${dueTodayCount === 1 ? "" : "s"} due today`;
  }
  if (documentCount > 0) {
    return `${documentCount} doc${documentCount === 1 ? "" : "s"} in progress`;
  }
  return `${dueTodayCount} review${dueTodayCount === 1 ? "" : "s"} due today`;
}

function formatWritingStyleLabel(
  value: NonNullable<NonNullable<UserSettings["working_style"]>["writing_style"]>,
  locale: AppLocale,
): string {
  if (locale === "ko") {
    switch (value) {
      case "concise":
        return "간결한 스타일";
      case "balanced":
        return "균형 잡힌 스타일";
      case "detailed":
        return "상세한 스타일";
    }
  }

  if (locale === "ja") {
    switch (value) {
      case "concise":
        return "簡潔なスタイル";
      case "balanced":
        return "バランス型スタイル";
      case "detailed":
        return "詳細なスタイル";
    }
  }

  if (locale === "zh") {
    switch (value) {
      case "concise":
        return "简洁风格";
      case "balanced":
        return "平衡风格";
      case "detailed":
        return "详细风格";
    }
  }

  switch (value) {
    case "concise":
      return "concise";
    case "balanced":
      return "balanced";
    case "detailed":
      return "detailed";
  }
}

function isTaskDueToday(nextRunAt: string | null): boolean {
  if (!nextRunAt) {
    return false;
  }

  const runDate = new Date(nextRunAt);
  const now = new Date();
  return (
    runDate.getFullYear() === now.getFullYear() &&
    runDate.getMonth() === now.getMonth() &&
    runDate.getDate() === now.getDate()
  );
}

function formatShortDate(value: string, localeTag: string): string {
  return new Date(value).toLocaleDateString(localeTag, {
    month: "short",
    day: "numeric",
  });
}

function getConnectionStatusLabel(status: string, copy: ChatLocaleCopy): string {
  switch (status) {
    case "connected":
      return copy.statusOnline;
    case "degraded":
      return copy.statusFallback;
    case "connecting":
      return copy.statusConnecting;
    case "disconnected":
      return copy.statusOffline;
    default:
      return status;
  }
}
