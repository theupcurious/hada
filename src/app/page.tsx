"use client";

import { Button } from "@/components/ui/button";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  Clock3,
  Database,
  Eye,
  FileSearch,
  FileText,
  FolderKanban,
  Link2,
  Mail,
  MessageCircle,
  PenLine,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface FeatureCopy {
  title: string;
  description: string;
}

interface HomeCopy {
  login: string;
  getStarted: string;
  eyebrow: string;
  heroTitle: string;
  capabilitiesHeading: string;
  capabilitiesLead: string;
  spacesEyebrow: string;
  spacesHeading: string;
  spacesLead: string;
  spacesItems: { name: string; role: string }[];
  spacesFacets: FeatureCopy[];
  trustHeading: string;
  heroDescription: string;
  integrationBoundary: string;
  startFree: string;
  seeFeatures: string;
  userLabel: string;
  userPrompt: string;
  assistantLabel: string;
  assistantResponse: string;
  searchDone: string;
  sourcesReturned: string;
  documentDone: string;
  documentTitle: string;
  previewLabel: string;
  askPlaceholder: string;
  saved: string;
  edit: string;
  executiveSummary: string;
  summaryText: string;
  keyFindings: string;
  findings: string[];
  sources: string;
  steps: FeatureCopy[];
  worksTitle: string;
  works: FeatureCopy[];
  connectTitle: string;
  connectWhenNeeded: string;
  connected: FeatureCopy[];
  approvalTitle: string;
  approvalDescription: string;
  progressTitle: string;
  progressDescription: string;
  ctaTitle: string;
  ctaDescription: string;
  footerTagline: string;
}

const HOME_COPY: Record<AppLocale, HomeCopy> = {
  en: {
    login: "Log in",
    getStarted: "Get started",
    eyebrow: "An assistant that shows its work",
    heroTitle: "Move work forward — and see how it happened.",
    capabilitiesHeading: "Everything here works today.",
    capabilitiesLead:
      "No waitlists and no coming-soon labels. Sign up and the built-in tools are live; connect the rest whenever you want them.",
    spacesEyebrow: "Spaces",
    spacesHeading: "A dedicated assistant for each part of your work.",
    spacesLead:
      "Spin up a Space for investing, health, writing — anything. Each one keeps its own instructions, its own memory, and its own set of tools. Switch between them and Hada changes hats completely.",
    spacesItems: [
      { name: "Investing", role: "Tracks markets and flags risk. Never gives advice." },
      { name: "Health & Fitness", role: "Plans workouts and remembers your goals." },
      { name: "Writing", role: "Edits for clarity, keeping your voice." },
      { name: "Reading", role: "Summarizes and keeps notes on what you read." },
    ],
    spacesFacets: [
      { title: "Its own instructions", description: "Set the role and voice each Space works in." },
      { title: "Separate memory", description: "What Hada learns in one Space stays in that Space." },
      { title: "Scoped tools", description: "Choose which tools a Space can use — keep email out of investing." },
    ],
    trustHeading: "Nothing happens behind your back.",
    heroDescription:
      "Research current topics, turn useful answers into documents, and schedule recurring Hada workflows. Source links and tool progress stay visible.",
    integrationBoundary:
      "Connect Google for Gmail and Calendar. High-risk actions such as sending email pause for your approval.",
    startFree: "Start for free",
    seeFeatures: "See what works today",
    userLabel: "You",
    userPrompt: "Research the latest remote-work trends and save a brief.",
    assistantLabel: "Hada",
    assistantResponse: "I researched the latest remote-work trends and created a brief for you.",
    searchDone: "Web Search — Done",
    sourcesReturned: "6 source links returned",
    documentDone: "Create Document — Done",
    documentTitle: "Remote work brief",
    previewLabel:
      "Product preview: Hada researches remote-work trends, shows each tool step it ran, and saves a brief with source links.",
    askPlaceholder: "Ask anything…",
    saved: "Saved",
    edit: "Edit",
    executiveSummary: "Executive summary",
    summaryText:
      "Hybrid work remains common across knowledge teams, with organizations investing in clearer coordination and stronger documentation.",
    keyFindings: "Key findings",
    findings: [
      "Hybrid policies increasingly emphasize team-level norms.",
      "Clear documentation helps distributed teams move faster.",
      "Focused office time is replacing default attendance.",
    ],
    sources: "Sources",
    steps: [
      {
        title: "Research current information",
        description: "Search the web and receive supporting links with the result.",
      },
      {
        title: "Create durable documents",
        description: "Save and edit useful work in Hada Docs.",
      },
      {
        title: "Schedule Hada workflows",
        description: "Run one-time or recurring reminders, briefings, and follow-ups.",
      },
    ],
    worksTitle: "Works after signup",
    works: [
      { title: "Research", description: "Search the web and get results with source links." },
      { title: "Documents & Wiki", description: "Create, edit, and organize documents in Hada." },
      { title: "Scheduled workflows", description: "Set one-time or recurring reminders and briefings." },
      { title: "Memory", description: "Save useful preferences and recall them across conversations." },
      { title: "Spaces", description: "A dedicated assistant per topic — its own instructions, memory, and tools." },
    ],
    connectTitle: "Connect when needed",
    connectWhenNeeded: "Optional connection",
    connected: [
      { title: "Google Calendar", description: "List, create, update, and delete events." },
      { title: "Gmail", description: "Search, read, create drafts, and send with approval." },
      { title: "Google Drive", description: "Search and read files." },
      { title: "Telegram", description: "Continue text conversations with Hada." },
    ],
    approvalTitle: "High-risk actions pause for approval",
    approvalDescription: "Sensitive actions, such as sending email, pause for your review.",
    progressTitle: "You can inspect tool progress",
    progressDescription: "See the steps Hada takes, along with results and source links.",
    ctaTitle: "Start with one useful piece of work.",
    ctaDescription: "Research a topic, create a document, or schedule a Hada workflow.",
    footerTagline: "Hada — delegated work, kept visible",
  },
  ko: {
    login: "로그인",
    getStarted: "시작하기",
    eyebrow: "과정을 보여주는 어시스턴트",
    heroTitle: "업무를 앞으로. 진행 과정은 투명하게.",
    capabilitiesHeading: "여기 있는 기능은 오늘 바로 작동합니다.",
    capabilitiesLead:
      "대기 명단도, 출시 예정 표시도 없습니다. 가입하면 기본 기능은 바로 작동하고, 나머지는 원할 때 연결하면 됩니다.",
    spacesEyebrow: "스페이스",
    spacesHeading: "업무의 영역마다 전담 어시스턴트를.",
    spacesLead:
      "투자, 건강, 글쓰기 — 무엇이든 스페이스를 만드세요. 각 스페이스는 고유한 지침과 메모리, 그리고 사용할 도구를 따로 갖습니다. 스페이스를 전환하면 Hada가 완전히 다른 역할로 바뀝니다.",
    spacesItems: [
      { name: "투자", role: "시장을 추적하고 위험을 짚어줍니다. 조언은 하지 않습니다." },
      { name: "건강·운동", role: "운동을 계획하고 목표를 기억합니다." },
      { name: "글쓰기", role: "당신의 문체를 지키며 명확하게 다듬습니다." },
      { name: "리딩", role: "읽은 내용을 요약하고 메모로 남깁니다." },
    ],
    spacesFacets: [
      { title: "고유한 지침", description: "각 스페이스의 역할과 어조를 설정합니다." },
      { title: "분리된 메모리", description: "한 스페이스에서 배운 내용은 그 안에만 남습니다." },
      { title: "도구 범위 지정", description: "스페이스가 쓸 도구를 고르세요. 투자에서 이메일은 빼도 됩니다." },
    ],
    trustHeading: "당신 모르게 일어나는 일은 없습니다.",
    heroDescription:
      "최신 주제를 조사하고, 유용한 답변을 문서로 만들고, 반복 Hada 워크플로우를 예약하세요. 출처 링크와 도구 진행 상황을 확인할 수 있습니다.",
    integrationBoundary:
      "Gmail과 Calendar는 Google 연결 후 사용할 수 있습니다. 이메일 전송 같은 고위험 작업은 승인을 위해 멈춥니다.",
    startFree: "무료로 시작",
    seeFeatures: "현재 가능한 기능 보기",
    userLabel: "나",
    userPrompt: "최신 원격 근무 동향을 조사하고 브리프로 저장해 줘.",
    assistantLabel: "Hada",
    assistantResponse: "최신 원격 근무 동향을 조사하고 브리프를 만들었습니다.",
    searchDone: "웹 검색 — 완료",
    sourcesReturned: "출처 링크 6개 반환",
    documentDone: "문서 생성 — 완료",
    documentTitle: "원격 근무 브리프",
    previewLabel:
      "제품 미리보기: Hada가 원격 근무 동향을 조사하고, 실행한 각 도구 단계를 보여주며, 출처 링크와 함께 브리프를 저장합니다.",
    askPlaceholder: "무엇이든 물어보세요…",
    saved: "저장됨",
    edit: "편집",
    executiveSummary: "요약",
    summaryText:
      "하이브리드 근무는 지식 노동 팀에서 여전히 일반적이며, 조직은 더 명확한 협업 방식과 문서화에 투자하고 있습니다.",
    keyFindings: "핵심 내용",
    findings: [
      "하이브리드 정책은 팀 단위의 규칙을 더 강조합니다.",
      "명확한 문서는 분산된 팀의 실행 속도를 높입니다.",
      "목적 있는 출근이 기본 출근을 대체하고 있습니다.",
    ],
    sources: "출처",
    steps: [
      { title: "최신 정보 조사", description: "웹을 검색하고 결과와 함께 근거 링크를 받습니다." },
      { title: "지속 가능한 문서 생성", description: "유용한 업무를 Hada 문서에 저장하고 편집합니다." },
      { title: "Hada 워크플로우 예약", description: "일회성 또는 반복 알림, 브리핑, 후속 업무를 실행합니다." },
    ],
    worksTitle: "가입 후 바로 사용",
    works: [
      { title: "리서치", description: "웹을 검색하고 출처 링크가 포함된 결과를 받습니다." },
      { title: "문서와 위키", description: "Hada에서 문서를 만들고 편집하고 정리합니다." },
      { title: "예약 워크플로우", description: "일회성 또는 반복 알림과 브리핑을 설정합니다." },
      { title: "메모리", description: "유용한 선호도를 저장하고 대화 전반에서 불러옵니다." },
      { title: "스페이스", description: "주제별 전담 어시스턴트 — 고유한 지침, 메모리, 도구를 갖습니다." },
    ],
    connectTitle: "필요할 때 연결",
    connectWhenNeeded: "선택 연결",
    connected: [
      { title: "Google Calendar", description: "일정을 조회하고 생성, 수정, 삭제합니다." },
      { title: "Gmail", description: "검색, 읽기, 초안 생성, 승인 후 전송을 지원합니다." },
      { title: "Google Drive", description: "파일을 검색하고 읽습니다." },
      { title: "Telegram", description: "Hada와 텍스트 대화를 이어갑니다." },
    ],
    approvalTitle: "고위험 작업은 승인을 위해 멈춥니다",
    approvalDescription: "이메일 전송 같은 민감한 작업은 검토를 요청합니다.",
    progressTitle: "도구 진행 상황을 확인할 수 있습니다",
    progressDescription: "Hada가 수행한 단계와 결과, 출처 링크를 확인하세요.",
    ctaTitle: "유용한 업무 하나로 시작하세요.",
    ctaDescription: "주제를 조사하고, 문서를 만들거나 Hada 워크플로우를 예약하세요.",
    footerTagline: "Hada — 위임한 업무를 투명하게",
  },
  ja: {
    login: "ログイン",
    getStarted: "はじめる",
    eyebrow: "過程を見せるアシスタント",
    heroTitle: "仕事を前へ。進め方は見えるまま。",
    capabilitiesHeading: "ここにある機能は、今日から動きます。",
    capabilitiesLead:
      "順番待ちも「近日公開」もありません。登録すれば標準の機能はすぐ動き、残りは必要なときに接続できます。",
    spacesEyebrow: "スペース",
    spacesHeading: "仕事の領域ごとに、専用のアシスタントを。",
    spacesLead:
      "投資、健康、執筆 — 何でもスペースを作れます。それぞれが独自の指示、独自のメモリ、そして使えるツールを個別に持ちます。スペースを切り替えると、Hada は役割ごと入れ替わります。",
    spacesItems: [
      { name: "投資", role: "市場を追い、リスクを指摘。助言はしません。" },
      { name: "健康・運動", role: "トレーニングを計画し、目標を覚えます。" },
      { name: "執筆", role: "あなたの文体を保ちつつ、明確に整えます。" },
      { name: "リーディング", role: "読んだ内容を要約し、メモに残します。" },
    ],
    spacesFacets: [
      { title: "独自の指示", description: "各スペースの役割とトーンを設定します。" },
      { title: "分離したメモリ", description: "あるスペースで学んだことは、その中だけに残ります。" },
      { title: "ツールの範囲指定", description: "スペースが使えるツールを選択。投資からメールを外せます。" },
    ],
    trustHeading: "あなたの知らないところでは、何も起きません。",
    heroDescription:
      "最新トピックを調査し、有用な回答をドキュメントにして、定期 Hada ワークフローを予約できます。情報源リンクとツールの進捗も確認できます。",
    integrationBoundary:
      "Gmail と Calendar は Google 接続後に利用できます。メール送信など高リスクな操作は承認のため一時停止します。",
    startFree: "無料で始める",
    seeFeatures: "現在の機能を見る",
    userLabel: "あなた",
    userPrompt: "最新のリモートワーク動向を調査して概要を保存して。",
    assistantLabel: "Hada",
    assistantResponse: "最新のリモートワーク動向を調査し、概要を作成しました。",
    searchDone: "ウェブ検索 — 完了",
    sourcesReturned: "情報源リンク 6 件",
    documentDone: "ドキュメント作成 — 完了",
    documentTitle: "リモートワーク概要",
    previewLabel:
      "製品プレビュー: Hada がリモートワークの動向を調査し、実行した各ツールのステップを表示し、出典リンク付きのブリーフを保存します。",
    askPlaceholder: "何でも聞いてください…",
    saved: "保存済み",
    edit: "編集",
    executiveSummary: "エグゼクティブサマリー",
    summaryText:
      "ハイブリッド勤務は知識労働チームで一般的であり、組織は明確な連携方法と文書化へ投資しています。",
    keyFindings: "主なポイント",
    findings: [
      "ハイブリッド方針はチームごとのルールを重視しています。",
      "明確な文書は分散チームの実行を速めます。",
      "目的のある出社が一律の出社に代わりつつあります。",
    ],
    sources: "情報源",
    steps: [
      { title: "最新情報を調査", description: "ウェブを検索し、結果と根拠リンクを受け取ります。" },
      { title: "残るドキュメントを作成", description: "有用な成果を Hada Docs に保存して編集します。" },
      { title: "Hada ワークフローを予約", description: "単発・定期の通知、ブリーフィング、フォローを実行します。" },
    ],
    worksTitle: "登録後すぐに利用",
    works: [
      { title: "リサーチ", description: "ウェブを検索し、情報源リンク付きの結果を取得します。" },
      { title: "ドキュメントと Wiki", description: "Hada で文書を作成、編集、整理します。" },
      { title: "定期ワークフロー", description: "単発・定期の通知やブリーフィングを設定します。" },
      { title: "メモリ", description: "有用な設定を保存し、会話をまたいで呼び出します。" },
      { title: "スペース", description: "トピックごとの専用アシスタント — 独自の指示、メモリ、ツールを持ちます。" },
    ],
    connectTitle: "必要なときに接続",
    connectWhenNeeded: "任意の接続",
    connected: [
      { title: "Google Calendar", description: "予定を一覧、作成、更新、削除します。" },
      { title: "Gmail", description: "検索、閲覧、下書き、承認後の送信に対応します。" },
      { title: "Google Drive", description: "ファイルを検索して読み取ります。" },
      { title: "Telegram", description: "Hada とテキストで会話を続けます。" },
    ],
    approvalTitle: "高リスクな操作は承認のため停止",
    approvalDescription: "メール送信などの重要な操作は確認を求めます。",
    progressTitle: "ツールの進捗を確認できます",
    progressDescription: "Hada が行った手順、結果、情報源リンクを確認できます。",
    ctaTitle: "一つの役立つ仕事から始めましょう。",
    ctaDescription: "トピックの調査、ドキュメント作成、Hada ワークフローの予約ができます。",
    footerTagline: "Hada — 任せた仕事を見えるままに",
  },
  zh: {
    login: "登录",
    getStarted: "开始使用",
    eyebrow: "会展示过程的助手",
    heroTitle: "推进工作，也看清它如何完成。",
    capabilitiesHeading: "这里的每一项，今天就能用。",
    capabilitiesLead:
      "没有等候名单，也没有即将推出。注册后内置功能立刻可用，其余的随时连接。",
    spacesEyebrow: "空间",
    spacesHeading: "为工作的每个部分配一个专属助手。",
    spacesLead:
      "为投资、健康、写作 — 任何主题建立一个空间。每个空间都有自己的指令、自己的记忆，以及自己可用的工具。切换空间，Hada 就彻底换一副面孔。",
    spacesItems: [
      { name: "投资", role: "追踪市场并提示风险，从不给出建议。" },
      { name: "健康与健身", role: "规划锻炼并记住你的目标。" },
      { name: "写作", role: "保留你的文风，把文字改得更清晰。" },
      { name: "阅读", role: "总结所读内容并留下笔记。" },
    ],
    spacesFacets: [
      { title: "专属指令", description: "为每个空间设定角色与语气。" },
      { title: "独立记忆", description: "在一个空间学到的，只留在那个空间。" },
      { title: "工具范围", description: "选择每个空间可用的工具 — 让投资用不到邮件。" },
    ],
    trustHeading: "不会有任何事在你不知情时发生。",
    heroDescription:
      "研究最新主题，把有用回答转成文档，并安排定期 Hada 工作流。来源链接和工具进度始终可见。",
    integrationBoundary:
      "连接 Google 后可使用 Gmail 和 Calendar。发送邮件等高风险操作会暂停并等待你的批准。",
    startFree: "免费开始",
    seeFeatures: "查看现有功能",
    userLabel: "你",
    userPrompt: "研究最新的远程办公趋势并保存一份简报。",
    assistantLabel: "Hada",
    assistantResponse: "我研究了最新的远程办公趋势，并为你创建了一份简报。",
    searchDone: "网页搜索 — 完成",
    sourcesReturned: "返回 6 个来源链接",
    documentDone: "创建文档 — 完成",
    documentTitle: "远程办公简报",
    previewLabel:
      "产品预览：Hada 研究远程办公趋势，展示执行的每个工具步骤，并保存带来源链接的简报。",
    askPlaceholder: "问任何问题…",
    saved: "已保存",
    edit: "编辑",
    executiveSummary: "执行摘要",
    summaryText:
      "混合办公在知识型团队中仍然普遍，组织正在投入更清晰的协作方式和更完善的文档。",
    keyFindings: "主要发现",
    findings: [
      "混合办公政策越来越重视团队层面的规则。",
      "清晰的文档帮助分布式团队更快推进工作。",
      "有明确目的的到岗正在取代默认到岗。",
    ],
    sources: "来源",
    steps: [
      { title: "研究最新信息", description: "搜索网页并获得附带支持链接的结果。" },
      { title: "创建长期文档", description: "在 Hada 文档中保存和编辑有用成果。" },
      { title: "安排 Hada 工作流", description: "运行一次性或定期提醒、简报和后续任务。" },
    ],
    worksTitle: "注册后即可使用",
    works: [
      { title: "研究", description: "搜索网页并获得包含来源链接的结果。" },
      { title: "文档与 Wiki", description: "在 Hada 中创建、编辑和整理文档。" },
      { title: "定时工作流", description: "设置一次性或定期提醒和简报。" },
      { title: "记忆", description: "保存有用偏好并在不同对话中调用。" },
      { title: "空间", description: "按主题划分的专属助手 — 拥有自己的指令、记忆和工具。" },
    ],
    connectTitle: "需要时连接",
    connectWhenNeeded: "可选连接",
    connected: [
      { title: "Google Calendar", description: "列出、创建、更新和删除日程。" },
      { title: "Gmail", description: "搜索、阅读、创建草稿，并在批准后发送。" },
      { title: "Google Drive", description: "搜索并读取文件。" },
      { title: "Telegram", description: "继续与 Hada 进行文字对话。" },
    ],
    approvalTitle: "高风险操作会暂停等待批准",
    approvalDescription: "发送邮件等敏感操作会等待你的审查。",
    progressTitle: "你可以检查工具进度",
    progressDescription: "查看 Hada 执行的步骤、结果和来源链接。",
    ctaTitle: "从一件有用的工作开始。",
    ctaDescription: "研究一个主题、创建文档或安排 Hada 工作流。",
    footerTagline: "Hada — 委派工作，过程可见",
  },
};

const stepIcons: LucideIcon[] = [Search, FileText, CalendarClock];
const builtInIcons: LucideIcon[] = [Search, BookOpen, Clock3, Database, FolderKanban];
const integrationIcons: LucideIcon[] = [CalendarClock, Mail, FileSearch, MessageCircle];

// Locale-independent identity for the Spaces showcase cards. Names/roles are
// localized in copy; the emoji + accent are shared, mirroring the app's own
// per-space palette.
const spaceEmojis = ["📈", "💪", "✍️", "📚"];
const spaceAccents = ["#6366f1", "#ec4899", "#8b5cf6", "#14b8a6"];
const facetIcons: LucideIcon[] = [PenLine, Database, SlidersHorizontal];

function isCjkLocale(locale: AppLocale): boolean {
  return locale === "zh" || locale === "ja" || locale === "ko";
}

export default function Home() {
  const locale = useResolvedLocale();
  const copy = HOME_COPY[locale];
  const reduceMotion = !!useReducedMotion();

  // Latin display tracking is far too tight for CJK, whose glyphs are already
  // fixed-width and carry their own side bearings.
  const headingTracking = isCjkLocale(locale) ? "tracking-normal" : "tracking-[-0.045em]";
  const labelTracking = isCjkLocale(locale) ? "tracking-[0.05em]" : "tracking-[0.18em]";

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <header className="border-b border-zinc-900/10 bg-[#f7f6f2]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Hada home">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg shadow-sm">
              <Image
                src="/hada-logo.png"
                alt=""
                width={32}
                height={32}
                priority
                className="h-8 w-8 object-cover"
              />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Hada</span>
          </Link>

          <nav className="flex items-center gap-2" aria-label="Account">
            <Button asChild variant="ghost" className="rounded-full px-3 sm:px-4">
              <Link href="/auth/login">{copy.login}</Link>
            </Button>
            <Button asChild className="h-9 rounded-lg bg-teal-700 px-4 text-white shadow-sm hover:bg-teal-800">
              <Link href="/auth/signup">{copy.getStarted}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="max-w-xl"
            >
              <p className={`text-[11px] font-semibold uppercase text-teal-700 ${labelTracking}`}>
                {copy.eyebrow}
              </p>
              <h1
                className={`mt-6 font-display text-4xl font-medium leading-[1.06] sm:text-6xl sm:leading-[1.03] lg:text-[3.4rem] xl:text-[4.3rem] ${headingTracking}`}
              >
                {copy.heroTitle}
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-zinc-600">{copy.heroDescription}</p>

              <div className="mt-5 flex max-w-lg items-start gap-3 text-sm leading-6 text-zinc-600">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-700/10 text-teal-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <p>{copy.integrationBoundary}</p>
              </div>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="group h-12 rounded-lg bg-teal-700 px-8 text-white shadow-[0_10px_30px_-12px_rgba(15,118,110,0.7)] transition-all hover:bg-teal-800 hover:shadow-[0_14px_36px_-12px_rgba(15,118,110,0.75)] motion-reduce:transition-none">
                  <Link href="/auth/signup">{copy.startFree}</Link>
                </Button>
                <Link
                  href="#capabilities"
                  className="group inline-flex items-center gap-1.5 border-b border-teal-700/50 pb-1 text-sm font-medium text-teal-800 transition-colors hover:border-teal-800 motion-reduce:transition-none"
                >
                  {copy.seeFeatures}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
                </Link>
              </div>
            </motion.div>

            <ProductPreview copy={copy} reduceMotion={reduceMotion} />
          </div>
        </section>

        {/* Steps: an editorial numbered rail rather than another bordered card. */}
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl border-t border-zinc-900/10 lg:grid-cols-3">
            {copy.steps.map((step, index) => (
              <Reveal
                key={step.title}
                reduceMotion={reduceMotion}
                delay={index * 0.06}
                className="group border-b border-zinc-900/10 py-7 lg:border-b-0 lg:border-l lg:border-zinc-900/10 lg:px-8 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="font-display text-5xl font-medium leading-none text-teal-700/20 transition-colors group-hover:text-teal-700/35 motion-reduce:transition-none"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {(() => {
                    const Icon = stepIcons[index];
                    return <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-teal-700" />;
                  })()}
                </div>
                {/* h2: these are top-level page points with no section heading above them. */}
                <h2 className={`mt-4 font-display text-lg font-medium ${headingTracking}`}>
                  {step.title}
                </h2>
                <p className="mt-1.5 max-w-sm text-sm leading-6 text-zinc-600">{step.description}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <SpacesShowcase
          copy={copy}
          reduceMotion={reduceMotion}
          headingTracking={headingTracking}
          labelTracking={labelTracking}
        />

        <section id="capabilities" className="scroll-mt-8 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Reveal reduceMotion={reduceMotion} className="mx-auto max-w-7xl">
            <h2
              className={`max-w-2xl font-display text-3xl font-medium leading-[1.15] sm:text-4xl lg:text-[2.75rem] ${headingTracking}`}
            >
              {copy.capabilitiesHeading}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">{copy.capabilitiesLead}</p>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-7xl gap-10 lg:grid-cols-2 lg:gap-0">
            <CapabilityColumn
              title={copy.worksTitle}
              items={copy.works}
              icons={builtInIcons}
              reduceMotion={reduceMotion}
              labelTracking={labelTracking}
            />
            <CapabilityColumn
              title={copy.connectTitle}
              items={copy.connected}
              icons={integrationIcons}
              badge={copy.connectWhenNeeded}
              reduceMotion={reduceMotion}
              labelTracking={labelTracking}
              divided
            />
          </div>
        </section>

        {/* The one full-bleed moment: the trust claim is the differentiator, so it gets the page's peak. */}
        <section className="relative overflow-hidden bg-zinc-950 px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 select-none font-display text-[10rem] font-medium leading-none text-white/[0.06] lg:block xl:right-16 xl:text-[13rem]"
          >
            하다
          </span>

          <div className="relative z-10 mx-auto max-w-7xl">
            <Reveal reduceMotion={reduceMotion}>
              <h2
                className={`max-w-3xl font-display text-3xl font-medium leading-[1.12] sm:text-5xl lg:text-[3.5rem] ${headingTracking}`}
              >
                {copy.trustHeading}
              </h2>
            </Reveal>

            <div className="mt-14 grid max-w-4xl gap-10 sm:mt-16 md:grid-cols-2 md:gap-14">
              <TrustPoint
                icon={ShieldCheck}
                title={copy.approvalTitle}
                description={copy.approvalDescription}
                reduceMotion={reduceMotion}
              />
              <TrustPoint
                icon={Eye}
                title={copy.progressTitle}
                description={copy.progressDescription}
                reduceMotion={reduceMotion}
                delay={0.08}
              />
            </div>
          </div>
        </section>

        <section className="px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <Reveal reduceMotion={reduceMotion} className="mx-auto max-w-2xl">
            <h2
              className={`font-display text-3xl font-medium leading-[1.15] sm:text-5xl ${headingTracking}`}
            >
              {copy.ctaTitle}
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-zinc-600">
              {copy.ctaDescription}
            </p>
            <Button
              asChild
              size="lg"
              className="group mt-9 h-14 rounded-lg bg-teal-700 px-10 text-base text-white shadow-[0_14px_40px_-14px_rgba(15,118,110,0.8)] transition-all hover:bg-teal-800 hover:shadow-[0_18px_48px_-14px_rgba(15,118,110,0.85)] motion-reduce:transition-none"
            >
              <Link href="/auth/signup">
                {copy.startFree}
                <ArrowRight className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
              </Link>
            </Button>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-zinc-900/10 px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{copy.footerTagline}</p>
          <p>© 2026 Hada</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Scroll-triggered entrance that only ever moves an element.
 * Opacity is deliberately untouched: if the viewport observer never fires, the
 * content stays fully readable instead of being stranded invisible.
 */
function Reveal({
  children,
  className,
  delay = 0,
  reduceMotion,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function ProductPreview({ copy, reduceMotion }: { copy: HomeCopy; reduceMotion: boolean }) {
  // Reveals the panel contents in the order Hada actually produced them.
  const container = {
    hidden: {},
    shown: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
  };
  const step = {
    hidden: { opacity: 0, y: 10 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  };

  return (
    <motion.div
      role="img"
      aria-label={copy.previewLabel}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.1, ease: "easeOut" }}
      className="grid min-w-0 gap-3 sm:grid-cols-[0.78fr_1.22fr]"
    >
      <motion.div
        variants={reduceMotion ? undefined : container}
        initial={reduceMotion ? false : "hidden"}
        animate="shown"
        className="flex min-w-0 flex-col rounded-xl border border-zinc-900/10 bg-white p-4 shadow-[0_18px_55px_-35px_rgba(24,24,27,0.45)]"
      >
        <motion.div variants={step}>
          <ChatIdentity label={copy.userLabel} muted />
          <div className="ml-8 mt-2 rounded-lg bg-zinc-100 px-3 py-2.5 text-xs leading-5">
            {copy.userPrompt}
          </div>
        </motion.div>

        <motion.div variants={step} className="mt-4">
          <ChatIdentity label={copy.assistantLabel} />
          <p className="ml-8 mt-2 text-xs leading-5 text-zinc-700">{copy.assistantResponse}</p>
        </motion.div>

        <div className="ml-8 mt-4 space-y-2">
          <motion.div variants={step}>
            <ToolResult icon={Search} title={copy.searchDone} detail={copy.sourcesReturned} />
          </motion.div>
          <motion.div variants={step}>
            <ToolResult icon={FileText} title={copy.documentDone} detail={copy.documentTitle} />
          </motion.div>
        </div>

        <motion.div variants={step} className="mt-auto pt-5">
          <div className="flex items-center justify-between rounded-lg border border-zinc-900/10 px-3 py-2.5 text-xs text-zinc-400">
            <span>{copy.askPlaceholder}</span>
            <Send className="h-3.5 w-3.5 text-zinc-500" />
          </div>
        </motion.div>
      </motion.div>

      <div className="min-w-0 rounded-xl border border-zinc-900/10 bg-white shadow-[0_18px_55px_-35px_rgba(24,24,27,0.45)]">
        <div className="flex items-center justify-between border-b border-zinc-900/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
            <span className="truncate text-xs font-semibold">{copy.documentTitle}</span>
            <span className="hidden items-center gap-1 text-[10px] text-teal-700 sm:inline-flex">
              <Check className="h-3 w-3" />
              {copy.saved}
            </span>
          </div>
          <span className="rounded-md border border-zinc-900/10 px-2 py-1 text-[10px] text-zinc-600">
            {copy.edit}
          </span>
        </div>

        {/* Plain elements, not headings — this is a mockup and must stay out of the page outline. */}
        <div className="p-4 sm:p-5">
          <p className="font-display text-xl font-medium">{copy.documentTitle}</p>
          <p className="mt-4 text-[11px] font-semibold">{copy.executiveSummary}</p>
          <p className="mt-1 text-[11px] leading-[1.55] text-zinc-600">{copy.summaryText}</p>

          <p className="mt-4 text-[11px] font-semibold">{copy.keyFindings}</p>
          <ul className="mt-1.5 space-y-1">
            {copy.findings.map((finding) => (
              <li key={finding} className="flex gap-2 text-[11px] leading-[1.45] text-zinc-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                {finding}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[11px] font-semibold">{copy.sources}</p>
          <div className="mt-1.5 space-y-1 text-[10px] text-teal-700">
            <SourceLine index="1" domain="microsoft.com/worklab" />
            <SourceLine index="2" domain="weforum.org/future-of-work" />
            <SourceLine index="3" domain="owllabs.com/hybrid-work" />
            <SourceLine index="4" domain="gallup.com/workplace" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChatIdentity({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
          muted ? "bg-zinc-200 text-zinc-600" : "bg-teal-700 text-white"
        }`}
      >
        {muted ? label.slice(0, 1) : "H"}
      </span>
      <span className="text-[11px] font-semibold">{label}</span>
    </div>
  );
}

function ToolResult({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-zinc-900/10 bg-zinc-50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-teal-700" />
        <span className="text-[10px] font-semibold text-zinc-800 xl:text-[11px]">{title}</span>
      </div>
      <div className="mt-1 flex items-center gap-1 pl-5 text-[10px] text-zinc-500">
        {title.toLowerCase().includes("search") ? <Link2 className="h-2.5 w-2.5" /> : null}
        {detail}
      </div>
    </div>
  );
}

function SourceLine({ index, domain }: { index: string; domain: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-[9px] text-zinc-500">
        {index}
      </span>
      <span className="truncate">{domain}</span>
    </div>
  );
}

/**
 * Label/description pairs, so they read as a definition list rather than as a
 * stack of headings competing with the section title.
 */
function CapabilityColumn({
  title,
  items,
  icons,
  badge,
  reduceMotion,
  labelTracking,
  divided = false,
}: {
  title: string;
  items: FeatureCopy[];
  icons: LucideIcon[];
  badge?: string;
  reduceMotion: boolean;
  labelTracking: string;
  divided?: boolean;
}) {
  return (
    <Reveal
      reduceMotion={reduceMotion}
      delay={divided ? 0.08 : 0}
      className={divided ? "lg:border-l lg:border-zinc-900/10 lg:pl-10" : "lg:pr-10"}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className={`text-[11px] font-semibold uppercase text-zinc-500 ${labelTracking}`}>
          {title}
        </h3>
        {badge ? (
          <span className="rounded-full border border-teal-700/25 px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-teal-800">
            {badge}
          </span>
        ) : null}
      </div>
      <dl className="mt-6 border-t border-zinc-900/10">
        {items.map((item, index) => {
          const Icon = icons[index];
          return (
            <div
              key={item.title}
              className="group grid gap-1.5 border-b border-zinc-900/10 py-4 transition-colors hover:bg-white/50 sm:grid-cols-[1fr_1.5fr] sm:items-baseline sm:gap-4 motion-reduce:transition-none"
            >
              <dt className="flex items-center gap-3">
                <Icon
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-teal-700 motion-reduce:transition-none"
                />
                <span className="text-sm font-semibold">{item.title}</span>
              </dt>
              <dd className="pl-7 text-sm leading-6 text-zinc-600 sm:pl-0">{item.description}</dd>
            </div>
          );
        })}
      </dl>
    </Reveal>
  );
}

/**
 * The Spaces differentiator: a row of accent-colored space cards, each a
 * specialized assistant, over a three-up explanation of what a Space actually
 * scopes — instructions, memory, and tools. Sits on a tinted band so it reads
 * as its own beat between the steps rail and the capability list.
 */
function SpacesShowcase({
  copy,
  reduceMotion,
  headingTracking,
  labelTracking,
}: {
  copy: HomeCopy;
  reduceMotion: boolean;
  headingTracking: string;
  labelTracking: string;
}) {
  return (
    <section className="border-y border-zinc-900/10 bg-white/60 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <Reveal reduceMotion={reduceMotion} className="mx-auto max-w-7xl">
        <p className={`text-[11px] font-semibold uppercase text-teal-700 ${labelTracking}`}>
          {copy.spacesEyebrow}
        </p>
        <h2
          className={`mt-4 max-w-2xl font-display text-3xl font-medium leading-[1.15] sm:text-4xl lg:text-[2.75rem] ${headingTracking}`}
        >
          {copy.spacesHeading}
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">{copy.spacesLead}</p>
      </Reveal>

      <div className="mx-auto mt-12 grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {copy.spacesItems.map((item, index) => {
          const accent = spaceAccents[index % spaceAccents.length];
          return (
            <Reveal
              key={item.name}
              reduceMotion={reduceMotion}
              delay={index * 0.06}
              className="group flex flex-col rounded-xl border border-zinc-900/10 bg-white p-4 shadow-[0_18px_55px_-40px_rgba(24,24,27,0.5)] transition-colors hover:border-zinc-900/20 motion-reduce:transition-none"
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ backgroundColor: `${accent}1a` }}
                >
                  {spaceEmojis[index % spaceEmojis.length]}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  {item.name}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{item.role}</p>
            </Reveal>
          );
        })}
      </div>

      <div className="mx-auto mt-10 grid max-w-7xl gap-8 border-t border-zinc-900/10 pt-10 sm:grid-cols-3 sm:gap-10">
        {copy.spacesFacets.map((facet, index) => {
          const Icon = facetIcons[index];
          return (
            <Reveal key={facet.title} reduceMotion={reduceMotion} delay={index * 0.06}>
              <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" />
              <h3 className="mt-4 text-sm font-semibold">{facet.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-zinc-600">{facet.description}</p>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function TrustPoint({
  icon: Icon,
  title,
  description,
  reduceMotion,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  reduceMotion: boolean;
  delay?: number;
}) {
  return (
    <Reveal reduceMotion={reduceMotion} delay={delay} className="max-w-md">
      <Icon aria-hidden="true" className="h-7 w-7 text-teal-400" />
      <h3 className="mt-5 text-xl font-semibold leading-snug">{title}</h3>
      <p className="mt-3 text-base leading-7 text-zinc-400">{description}</p>
    </Reveal>
  );
}
