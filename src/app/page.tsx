"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const featureCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08 },
  }),
};

type HomeFeature = {
  title: string;
  desc: string;
  icon: string;
};

const HOME_COPY: Record<
  AppLocale,
  {
    login: string;
    getStarted: string;
    heroTitlePrefix: string;
    heroTitleAccent: string;
    heroDescription: string;
    startFree: string;
    seeFeatures: string;
    previewYou: string;
    previewUserMessage: string;
    previewAssistantMessage: string;
    previewCardTitle: string;
    previewCardSubtitle: string;
    previewCardCta: string;
    capabilities: string;
    featuresHeadingPrefix: string;
    featuresHeadingAccent: string;
    footerTagline: string;
    features: HomeFeature[];
  }
> = {
  en: {
    login: "Log in",
    getStarted: "Get Started",
    heroTitlePrefix: "Your AI assistant that",
    heroTitleAccent: "actually does things",
    heroDescription:
      "Hada manages your calendar, drafts emails, books appointments, does research, and handles tasks — like having a brilliant executive assistant available 24/7.",
    startFree: "Start for free",
    seeFeatures: "See what Hada can do",
    previewYou: "You",
    previewUserMessage: "Book me a haircut for Friday afternoon",
    previewAssistantMessage: "I found 3 salons near you with Friday availability:",
    previewCardTitle: "The Cutting Room",
    previewCardSubtitle: "2:00 PM, 4:00 PM available",
    previewCardCta: "Book 2pm",
    capabilities: "Capabilities",
    featuresHeadingPrefix: "What Hada can do",
    featuresHeadingAccent: "for you",
    footerTagline: "Hada — Your AI Assistant",
    features: [
      { title: "Calendar", desc: "Schedule meetings, check availability, send invites", icon: "📅" },
      { title: "Email", desc: "Draft responses, summarize threads, send on your behalf", icon: "✉️" },
      { title: "Research", desc: "Find information, compare options, create summaries", icon: "🔍" },
      { title: "Tasks", desc: "Set reminders, schedule recurring jobs, follow up automatically", icon: "✅" },
      { title: "Telegram", desc: "Message Hada from anywhere — works over Telegram too", icon: "💬" },
      { title: "Memory", desc: "Remembers your preferences and context across every conversation", icon: "🧠" },
    ],
  },
  ko: {
    login: "로그인",
    getStarted: "시작하기",
    heroTitlePrefix: "실제로 일을 처리하는",
    heroTitleAccent: "AI 비서",
    heroDescription:
      "Hada는 캘린더 관리, 이메일 초안 작성, 예약 진행, 리서치, 작업 처리를 도와줍니다. 24시간 함께하는 유능한 비서처럼 일합니다.",
    startFree: "무료로 시작",
    seeFeatures: "Hada 기능 보기",
    previewYou: "나",
    previewUserMessage: "금요일 오후에 미용실 예약해줘",
    previewAssistantMessage: "금요일 가능한 근처 미용실 3곳을 찾았어요:",
    previewCardTitle: "더 커팅 룸",
    previewCardSubtitle: "오후 2:00, 4:00 가능",
    previewCardCta: "2시 예약",
    capabilities: "기능",
    featuresHeadingPrefix: "Hada가 도와드릴 수 있는",
    featuresHeadingAccent: "일들",
    footerTagline: "Hada — 당신의 AI 비서",
    features: [
      { title: "캘린더", desc: "미팅 예약, 가능 시간 확인, 초대 발송", icon: "📅" },
      { title: "이메일", desc: "답장 초안, 스레드 요약, 대신 발송", icon: "✉️" },
      { title: "리서치", desc: "정보 탐색, 옵션 비교, 요약 정리", icon: "🔍" },
      { title: "작업", desc: "리마인더 설정, 반복 작업 스케줄, 자동 후속", icon: "✅" },
      { title: "텔레그램", desc: "언제든 텔레그램으로 Hada와 대화", icon: "💬" },
      { title: "메모리", desc: "대화 전반에서 선호도와 맥락 유지", icon: "🧠" },
    ],
  },
  ja: {
    login: "ログイン",
    getStarted: "はじめる",
    heroTitlePrefix: "本当に作業を進める",
    heroTitleAccent: "AIアシスタント",
    heroDescription:
      "Hada はカレンダー管理、メール下書き、予約、調査、タスク処理まで対応。24時間使える有能な秘書のように働きます。",
    startFree: "無料で始める",
    seeFeatures: "Hada の機能を見る",
    previewYou: "あなた",
    previewUserMessage: "金曜の午後にヘアカットを予約して",
    previewAssistantMessage: "金曜に空きがある近くのサロンを3件見つけました:",
    previewCardTitle: "ザ・カッティングルーム",
    previewCardSubtitle: "14:00 / 16:00 空きあり",
    previewCardCta: "14時を予約",
    capabilities: "機能",
    featuresHeadingPrefix: "Hada があなたのために",
    featuresHeadingAccent: "できること",
    footerTagline: "Hada — あなたのAIアシスタント",
    features: [
      { title: "カレンダー", desc: "予定調整、空き確認、招待送信", icon: "📅" },
      { title: "メール", desc: "返信下書き、スレッド要約、代理送信", icon: "✉️" },
      { title: "調査", desc: "情報収集、比較、要約作成", icon: "🔍" },
      { title: "タスク", desc: "リマインダー、定期実行、フォロー自動化", icon: "✅" },
      { title: "Telegram", desc: "どこからでも Telegram で Hada と会話", icon: "💬" },
      { title: "メモリ", desc: "会話をまたいで好みと文脈を保持", icon: "🧠" },
    ],
  },
};

export default function Home() {
  const locale = useResolvedLocale();
  const copy = HOME_COPY[locale];

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black overflow-hidden">
      {/* Background glow accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-500/10 via-cyan-500/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-gradient-to-tl from-cyan-500/8 via-teal-400/5 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-4 lg:px-8 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden shadow-lg shadow-teal-500/20">
            <Image src="/hada-logo.png" alt="Hada" width={24} height={24} className="h-6 w-6 object-cover" />
          </div>
          <span className="text-xl font-semibold">Hada</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/auth/login">
            <Button variant="ghost">{copy.login}</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="gradient-brand text-white border-0 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300">
              {copy.getStarted}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-3xl pt-12"
        >
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {copy.heroTitlePrefix} <span className="gradient-text">{copy.heroTitleAccent}</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
            {copy.heroDescription}
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="h-12 px-8 text-base gradient-brand text-white border-0 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.02] transition-all duration-300"
              >
                {copy.startFree}
              </Button>
            </Link>
            <Link href="#features">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base backdrop-blur-sm hover:scale-[1.02] transition-all duration-200"
              >
                {copy.seeFeatures}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Chat Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="relative mt-16 w-full max-w-2xl"
        >
          {/* Glow behind preview */}
          <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-teal-500/15 via-cyan-500/10 to-teal-400/15 blur-2xl" style={{ animation: "glow-pulse 4s ease-in-out infinite" }} />
          <div className="glass relative rounded-2xl p-6" style={{ animation: "float 6s ease-in-out infinite" }}>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <span className="text-xs text-muted-foreground">{copy.previewYou}</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-2">
                  <p className="text-sm">{copy.previewUserMessage}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-brand text-white shadow-md shadow-teal-500/20">
                  <span className="text-sm font-bold">H</span>
                </div>
                <div className="flex-1 space-y-3 text-left">
                  <div className="inline-block max-w-[80%] rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-2">
                    <p className="text-sm">{copy.previewAssistantMessage}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/50 p-3 backdrop-blur-sm transition-all hover:border-border/80 hover:bg-card/70">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{copy.previewCardTitle}</p>
                        <p className="text-sm text-muted-foreground">{copy.previewCardSubtitle}</p>
                      </div>
                      <Button size="sm" className="gradient-brand text-white border-0 shadow-sm shadow-teal-500/20 text-xs">{copy.previewCardCta}</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features */}
      <section id="features" className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
          >
            <p className="label mb-3 text-center">{copy.capabilities}</p>
            <h2 className="text-center text-3xl font-bold">
              {copy.featuresHeadingPrefix} <span className="gradient-text">{copy.featuresHeadingAccent}</span>
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {copy.features.map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={featureCardVariants}
                className="group glass rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-teal-500/5 cursor-default"
              >
                <span className="text-2xl mb-3 block">{feature.icon}</span>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border/50 px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-muted-foreground">{copy.footerTagline}</p>
          <p className="text-sm text-muted-foreground">© 2026 Hada</p>
        </div>
      </footer>
    </div>
  );
}
