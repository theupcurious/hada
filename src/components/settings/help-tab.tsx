"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";

export function HelpTab() {
  const locale = useResolvedLocale();
  const copy = HELP_COPY[locale];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{copy.title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.docsSection.title}</CardTitle>
          <CardDescription>{copy.docsSection.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {copy.docsSection.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.ingestSection.title}</CardTitle>
          <CardDescription>{copy.ingestSection.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {copy.ingestSection.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.statusSection.title}</CardTitle>
          <CardDescription>{copy.statusSection.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {copy.statusSection.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.promptGuideSection.title}</CardTitle>
          <CardDescription>{copy.promptGuideSection.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
              {copy.promptGuideSection.formulaTitle}
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {copy.promptGuideSection.formula}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
              {copy.promptGuideSection.patternsTitle}
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {copy.promptGuideSection.patterns.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
              {copy.promptGuideSection.mistakesTitle}
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {copy.promptGuideSection.mistakes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.quickLinksTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href="/docs"
            className="rounded-full border border-zinc-200/70 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-900/70"
          >
            {copy.openDocs}
          </Link>
          <Link
            href="/chat"
            className="rounded-full border border-zinc-200/70 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-900/70"
          >
            {copy.openChat}
          </Link>
          <Link
            href="/settings?tab=status"
            className="rounded-full border border-zinc-200/70 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-900/70"
          >
            {copy.openStatus}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

type HelpSection = {
  title: string;
  description: string;
  items: string[];
};

type HelpCopy = {
  title: string;
  subtitle: string;
  docsSection: HelpSection;
  ingestSection: HelpSection;
  statusSection: HelpSection;
  promptGuideSection: {
    title: string;
    description: string;
    formulaTitle: string;
    formula: string;
    patternsTitle: string;
    patterns: string[];
    mistakesTitle: string;
    mistakes: string[];
  };
  quickLinksTitle: string;
  openDocs: string;
  openChat: string;
  openStatus: string;
};

const HELP_COPY: Record<AppLocale, HelpCopy> = {
  en: {
    title: "Help",
    subtitle: "Quick explanations for docs, wiki ingest, and chat status signals.",
    docsSection: {
      title: "Docs Basics",
      description: "How documents and folders are organized.",
      items: [
        "Use the upload button in Docs to add .md or .txt files to your workspace.",
        "Files stay in the folder you choose. The wiki folder is reserved for wiki pages generated by Hada.",
        "Use Share to create a public read-only link. Use Download to export markdown.",
      ],
    },
    ingestSection: {
      title: "Ingest into Wiki",
      description: "What the ingest button does.",
      items: [
        "The Ingest into Wiki button appears on non-wiki documents when a wiki already exists.",
        "Clicking it opens Chat and auto-sends an ingest request with the document id for exact matching.",
        "If you do not see the button, create or bootstrap your wiki first (for example, ask Chat to start your wiki).",
      ],
    },
    statusSection: {
      title: "How To Tell It Is Running",
      description: "Where to look for progress and completion.",
      items: [
        "Started: your ingest prompt appears as a user message and the assistant row shows Starting or status pills.",
        "Running: the assistant message stays in streaming mode with activity labels like Thinking or Working in background.",
        "Done: streaming stops and the assistant posts a final result message. If something fails, you will see an error message.",
      ],
    },
    promptGuideSection: {
      title: "Prompt Guide",
      description: "Use the same structure from docs/PROMPT_GUIDE.md to get higher quality results.",
      formulaTitle: "Prompt Formula",
      formula:
        "Objective + Context + Deliverable + Constraints. Example: Help me with [objective]. Context: [background]. Deliverable: [output]. Constraints: [rules, date range, tone, sources, deadline].",
      patternsTitle: "Strong Patterns",
      patterns: [
        "Research -> Synthesize -> Save -> Remind",
        "Read -> Revise -> Preserve Tone",
        "Review -> Prioritize -> Defend Time",
        "Learn -> Save Only Durable Parts to Memory",
      ],
      mistakesTitle: "Common Mistakes To Avoid",
      mistakes: [
        "Too vague (no clear objective)",
        "No deliverable (chat answer vs durable document not specified)",
        "No time frame or freshness requirement",
        "Saving temporary facts to memory",
      ],
    },
    quickLinksTitle: "Quick links",
    openDocs: "Open Docs",
    openChat: "Open Chat",
    openStatus: "Open Runtime Status",
  },
  ko: {
    title: "도움말",
    subtitle: "문서, 위키 인제스트, 채팅 상태 신호를 빠르게 확인하세요.",
    docsSection: {
      title: "문서 기본",
      description: "문서와 폴더가 정리되는 방식입니다.",
      items: [
        "Docs의 업로드 버튼으로 .md 또는 .txt 파일을 추가할 수 있습니다.",
        "파일은 선택한 폴더에 저장됩니다. wiki 폴더는 Hada가 만든 위키 페이지 전용입니다.",
        "Share는 읽기 전용 공개 링크를 만들고, Download는 마크다운으로 내보냅니다.",
      ],
    },
    ingestSection: {
      title: "위키로 인제스트",
      description: "인제스트 버튼 동작 방식입니다.",
      items: [
        "wiki가 이미 있을 때, wiki가 아닌 문서에서만 Ingest into Wiki 버튼이 보입니다.",
        "클릭하면 Chat으로 이동하며 문서 id가 포함된 인제스트 요청이 자동 전송됩니다.",
        "버튼이 보이지 않으면 먼저 wiki를 시작하세요. 예: Chat에 위키 시작을 요청.",
      ],
    },
    statusSection: {
      title: "진행 상태 확인",
      description: "진행 중/완료를 확인하는 위치입니다.",
      items: [
        "시작됨: 사용자 메시지가 보이고 assistant 행에 Starting 또는 상태 pill이 표시됩니다.",
        "진행 중: assistant 메시지가 스트리밍 상태로 유지되며 Thinking/Working in background 등이 표시됩니다.",
        "완료됨: 스트리밍이 끝나고 최종 결과가 표시됩니다. 실패 시 오류 메시지가 표시됩니다.",
      ],
    },
    promptGuideSection: {
      title: "프롬프트 가이드",
      description: "docs/PROMPT_GUIDE.md의 핵심 구조를 그대로 사용하세요.",
      formulaTitle: "프롬프트 공식",
      formula:
        "목표 + 맥락 + 산출물 + 제약. 예: Help me with [objective]. Context: [background]. Deliverable: [output]. Constraints: [rules, date range, tone, sources, deadline].",
      patternsTitle: "강한 패턴",
      patterns: [
        "Research -> Synthesize -> Save -> Remind",
        "Read -> Revise -> Preserve Tone",
        "Review -> Prioritize -> Defend Time",
        "Learn -> Save Only Durable Parts to Memory",
      ],
      mistakesTitle: "피해야 할 실수",
      mistakes: [
        "요청이 너무 모호함",
        "산출물 지정 없음",
        "시간 범위/최신성 요구 없음",
        "임시 정보를 메모리에 저장",
      ],
    },
    quickLinksTitle: "바로가기",
    openDocs: "Docs 열기",
    openChat: "Chat 열기",
    openStatus: "런타임 상태 열기",
  },
  ja: {
    title: "ヘルプ",
    subtitle: "Docs、Wiki取り込み、チャット状態の見方を簡潔に説明します。",
    docsSection: {
      title: "Docsの基本",
      description: "ドキュメントとフォルダの扱い方です。",
      items: [
        "Docsのアップロードボタンから .md / .txt を追加できます。",
        "ファイルは選択したフォルダに保存されます。wikiフォルダはHada生成のWikiページ専用です。",
        "Shareは公開の閲覧専用リンク、DownloadはMarkdownエクスポートです。",
      ],
    },
    ingestSection: {
      title: "Wikiへ取り込み",
      description: "取り込みボタンの動作です。",
      items: [
        "Wikiが存在し、対象がwiki外ドキュメントのときだけ Ingest into Wiki が表示されます。",
        "クリックするとChatへ移動し、文書id付きの取り込み依頼を自動送信します。",
        "ボタンが表示されない場合は、まずChatでWiki作成を実行してください。",
      ],
    },
    statusSection: {
      title: "実行中かどうかの見方",
      description: "開始・実行中・完了の判定方法です。",
      items: [
        "開始: ユーザーメッセージが出て、assistant行にStartingまたはステータスが表示されます。",
        "実行中: assistantメッセージがストリーミング状態になり、Thinking等のラベルが表示されます。",
        "完了: ストリーミングが止まり、最終結果メッセージが表示されます。失敗時はエラー表示です。",
      ],
    },
    promptGuideSection: {
      title: "プロンプトガイド",
      description: "docs/PROMPT_GUIDE.mdの構成を使うと精度が上がります。",
      formulaTitle: "プロンプトの式",
      formula:
        "Objective + Context + Deliverable + Constraints。例: Help me with [objective]. Context: [background]. Deliverable: [output]. Constraints: [rules, date range, tone, sources, deadline].",
      patternsTitle: "有効なパターン",
      patterns: [
        "Research -> Synthesize -> Save -> Remind",
        "Read -> Revise -> Preserve Tone",
        "Review -> Prioritize -> Defend Time",
        "Learn -> Save Only Durable Parts to Memory",
      ],
      mistakesTitle: "避けるべきミス",
      mistakes: [
        "目的が曖昧",
        "成果物の指定がない",
        "期間・最新性の指定がない",
        "一時的な情報をメモリ保存する",
      ],
    },
    quickLinksTitle: "クイックリンク",
    openDocs: "Docsを開く",
    openChat: "Chatを開く",
    openStatus: "ランタイム状態を開く",
  },
  zh: {
    title: "帮助",
    subtitle: "快速了解文档、Wiki 导入和聊天状态提示。",
    docsSection: {
      title: "文档基础",
      description: "文档与文件夹的组织方式。",
      items: [
        "在 Docs 中使用上传按钮添加 .md 或 .txt 文件。",
        "文件会保存在你选择的文件夹。wiki 文件夹仅用于 Hada 生成的 Wiki 页面。",
        "Share 会生成公开只读链接，Download 会导出 Markdown。",
      ],
    },
    ingestSection: {
      title: "导入到 Wiki",
      description: "导入按钮会做什么。",
      items: [
        "只有在 Wiki 已存在且当前文档不在 wiki 文件夹时，才会显示 Ingest into Wiki。",
        "点击后会跳转到 Chat，并自动发送带 document id 的导入请求。",
        "如果看不到按钮，请先在 Chat 中创建或初始化你的 Wiki。",
      ],
    },
    statusSection: {
      title: "如何判断是否在运行",
      description: "查看开始、进行中与完成状态。",
      items: [
        "已开始：你会看到用户消息，assistant 行会显示 Starting 或状态标签。",
        "进行中：assistant 消息保持流式状态，并显示 Thinking / Working in background 等标签。",
        "已完成：流式状态结束，assistant 给出最终结果；失败时会显示错误消息。",
      ],
    },
    promptGuideSection: {
      title: "提示词指南",
      description: "可直接复用 docs/PROMPT_GUIDE.md 的结构来提高结果质量。",
      formulaTitle: "提示词公式",
      formula:
        "目标 + 背景 + 交付物 + 约束。示例：Help me with [objective]. Context: [background]. Deliverable: [output]. Constraints: [rules, date range, tone, sources, deadline].",
      patternsTitle: "高效模式",
      patterns: [
        "Research -> Synthesize -> Save -> Remind",
        "Read -> Revise -> Preserve Tone",
        "Review -> Prioritize -> Defend Time",
        "Learn -> Save Only Durable Parts to Memory",
      ],
      mistakesTitle: "常见错误",
      mistakes: [
        "目标过于模糊",
        "没有明确交付物",
        "没有时间范围或时效要求",
        "把临时信息写入长期记忆",
      ],
    },
    quickLinksTitle: "快捷入口",
    openDocs: "打开 Docs",
    openChat: "打开 Chat",
    openStatus: "打开运行状态",
  },
};
