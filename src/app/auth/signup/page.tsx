"use client";

export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SIGNUP_COPY: Record<
  AppLocale,
  {
    title: string;
    subtitle: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    creatingAccount: string;
    createAccount: string;
    orContinueWith: string;
    continueWithGoogle: string;
    hasAccount: string;
    signIn: string;
  }
> = {
  en: {
    title: "Create your account",
    subtitle: "Start getting things done with Hada",
    namePlaceholder: "Name",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    creatingAccount: "Creating account...",
    createAccount: "Create account",
    orContinueWith: "or continue with",
    continueWithGoogle: "Continue with Google",
    hasAccount: "Already have an account?",
    signIn: "Sign in",
  },
  ko: {
    title: "계정 만들기",
    subtitle: "Hada와 함께 일을 더 빠르게 처리해 보세요",
    namePlaceholder: "이름",
    emailPlaceholder: "이메일",
    passwordPlaceholder: "비밀번호",
    creatingAccount: "계정 생성 중...",
    createAccount: "계정 만들기",
    orContinueWith: "또는 다음으로 계속",
    continueWithGoogle: "Google로 계속",
    hasAccount: "이미 계정이 있으신가요?",
    signIn: "로그인",
  },
  ja: {
    title: "アカウントを作成",
    subtitle: "Hada で作業をもっと進めましょう",
    namePlaceholder: "名前",
    emailPlaceholder: "メールアドレス",
    passwordPlaceholder: "パスワード",
    creatingAccount: "アカウント作成中...",
    createAccount: "アカウント作成",
    orContinueWith: "または次で続行",
    continueWithGoogle: "Google で続行",
    hasAccount: "すでにアカウントをお持ちですか？",
    signIn: "サインイン",
  },
};

export default function SignUpPage() {
  const locale = useResolvedLocale();
  const copy = SIGNUP_COPY[locale];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const params = new URLSearchParams({
        verify: "1",
        email,
      });
      router.push(`/auth/login?${params.toString()}`);
    }
  };

  const handleGoogleSignUp = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950 overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-teal-500/10 via-cyan-500/8 to-transparent blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 -m-2 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 blur-lg" style={{ animation: "glow-pulse 3s ease-in-out infinite" }} />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden shadow-lg shadow-teal-500/25">
                <Image src="/hada-logo.png" alt="Hada" width={36} height={36} className="h-9 w-9 object-cover" />
              </div>
            </div>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">{copy.title}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {copy.subtitle}
          </p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder={copy.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              type="email"
              placeholder={copy.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder={copy.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? copy.creatingAccount : copy.createAccount}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-zinc-50 px-3 text-zinc-400 dark:bg-zinc-950">
              {copy.orContinueWith}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {copy.continueWithGoogle}
        </Button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {copy.hasAccount}{" "}
          <Link href="/auth/login" className="font-medium text-zinc-900 dark:text-white">
            {copy.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
