"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const LOGIN_COPY: Record<
  AppLocale,
  {
    verifySentToEmail: (email: string) => string;
    verifySentGeneric: string;
    signInFailed: string;
    confirmEmailToContinue: string;
    enterEmailForResend: string;
    sentNewVerificationToEmail: (email: string) => string;
    enterEmailBeforeReset: string;
    resetSendFailed: string;
    title: string;
    subtitle: string;
    emailVerifiedTitle: string;
    emailVerifiedBody: string;
    verifyBannerTitle: string;
    verifyBannerFallback: string;
    verificationEmailSent: string;
    sending: string;
    resendLink: string;
    dismiss: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    forgotPassword: string;
    resetSentPrefix: string;
    signIn: string;
    signingIn: string;
    orContinueWith: string;
    continueWithGoogle: string;
    noAccount: string;
    signUp: string;
  }
> = {
  en: {
    verifySentToEmail: (email) => `We sent a verification link to ${email}.`,
    verifySentGeneric: "We sent a verification link to your email.",
    signInFailed: "Sign in failed",
    confirmEmailToContinue: "Please confirm your email address to continue.",
    enterEmailForResend: "Enter your email to resend the verification link.",
    sentNewVerificationToEmail: (email) => `We sent a new verification link to ${email}.`,
    enterEmailBeforeReset: "Enter your email address first, then click Forgot password.",
    resetSendFailed: "Could not send reset email. Check your internet connection and try again.",
    title: "Welcome back",
    subtitle: "Sign in to continue to Hada",
    emailVerifiedTitle: "Email verified!",
    emailVerifiedBody: "Your email address is confirmed. Sign in to get started.",
    verifyBannerTitle: "Verify your email to finish signup",
    verifyBannerFallback: "Check your inbox for a verification link.",
    verificationEmailSent: "Verification email sent.",
    sending: "Sending...",
    resendLink: "Resend link",
    dismiss: "Dismiss",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    forgotPassword: "Forgot password?",
    resetSentPrefix: "Check your inbox — we sent a password reset link to",
    signIn: "Sign in",
    signingIn: "Signing in...",
    orContinueWith: "or continue with",
    continueWithGoogle: "Continue with Google",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
  },
  ko: {
    verifySentToEmail: (email) => `${email} 주소로 인증 링크를 보냈습니다.`,
    verifySentGeneric: "이메일로 인증 링크를 보냈습니다.",
    signInFailed: "로그인에 실패했습니다.",
    confirmEmailToContinue: "계속하려면 이메일 인증을 완료해 주세요.",
    enterEmailForResend: "인증 링크를 다시 받으려면 이메일을 입력해 주세요.",
    sentNewVerificationToEmail: (email) => `${email} 주소로 새 인증 링크를 보냈습니다.`,
    enterEmailBeforeReset: "먼저 이메일을 입력한 후 비밀번호 찾기를 눌러 주세요.",
    resetSendFailed: "재설정 이메일을 보내지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    title: "다시 오신 것을 환영합니다",
    subtitle: "Hada를 계속 사용하려면 로그인하세요",
    emailVerifiedTitle: "이메일 인증 완료!",
    emailVerifiedBody: "이메일 인증이 완료되었습니다. 로그인하여 시작하세요.",
    verifyBannerTitle: "가입을 완료하려면 이메일 인증이 필요합니다",
    verifyBannerFallback: "받은편지함에서 인증 링크를 확인해 주세요.",
    verificationEmailSent: "인증 이메일을 전송했습니다.",
    sending: "전송 중...",
    resendLink: "링크 다시 보내기",
    dismiss: "닫기",
    emailPlaceholder: "이메일",
    passwordPlaceholder: "비밀번호",
    forgotPassword: "비밀번호를 잊으셨나요?",
    resetSentPrefix: "받은편지함을 확인하세요. 비밀번호 재설정 링크를 다음 주소로 보냈습니다:",
    signIn: "로그인",
    signingIn: "로그인 중...",
    orContinueWith: "또는 다음으로 계속",
    continueWithGoogle: "Google로 계속",
    noAccount: "계정이 없으신가요?",
    signUp: "회원가입",
  },
  ja: {
    verifySentToEmail: (email) => `${email} に確認リンクを送信しました。`,
    verifySentGeneric: "メールに確認リンクを送信しました。",
    signInFailed: "サインインに失敗しました。",
    confirmEmailToContinue: "続行するにはメール確認を完了してください。",
    enterEmailForResend: "再送するにはメールアドレスを入力してください。",
    sentNewVerificationToEmail: (email) => `${email} に新しい確認リンクを送信しました。`,
    enterEmailBeforeReset: "先にメールアドレスを入力してから「パスワードを忘れた」を押してください。",
    resetSendFailed: "再設定メールを送信できませんでした。接続を確認して再試行してください。",
    title: "おかえりなさい",
    subtitle: "Hada を続けるにはサインインしてください",
    emailVerifiedTitle: "メール確認が完了しました！",
    emailVerifiedBody: "メールアドレスの確認が完了しました。サインインして開始してください。",
    verifyBannerTitle: "登録完了にはメール確認が必要です",
    verifyBannerFallback: "受信トレイで確認リンクをご確認ください。",
    verificationEmailSent: "確認メールを送信しました。",
    sending: "送信中...",
    resendLink: "リンクを再送",
    dismiss: "閉じる",
    emailPlaceholder: "メールアドレス",
    passwordPlaceholder: "パスワード",
    forgotPassword: "パスワードをお忘れですか？",
    resetSentPrefix: "受信トレイを確認してください。パスワード再設定リンクを次へ送信しました:",
    signIn: "サインイン",
    signingIn: "サインイン中...",
    orContinueWith: "または次で続行",
    continueWithGoogle: "Google で続行",
    noAccount: "アカウントをお持ちでないですか？",
    signUp: "登録",
  },
};

export default function LoginForm() {
  const locale = useResolvedLocale();
  const copy = LOGIN_COPY[locale];
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";
  const verifyFromQuery = searchParams.get("verify") === "1";
  const emailVerified = searchParams.get("verified") === "1";

  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showVerifyBanner, setShowVerifyBanner] = useState(verifyFromQuery);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(
    verifyFromQuery
      ? emailFromQuery
        ? copy.verifySentToEmail(emailFromQuery)
        : copy.verifySentGeneric
      : null,
  );
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const message = error.message || copy.signInFailed;
      setError(message);
      if (message.toLowerCase().includes("confirm") || message.toLowerCase().includes("verified")) {
        setShowVerifyBanner(true);
        setVerifyMessage(copy.confirmEmailToContinue);
      }
      setLoading(false);
    } else {
      router.push("/chat");
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setResendError(copy.enterEmailForResend);
      setResendStatus("error");
      return;
    }

    setResendStatus("sending");
    setResendError(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setResendError(error.message);
      setResendStatus("error");
      return;
    }

    setResendStatus("sent");
    setVerifyMessage(copy.sentNewVerificationToEmail(targetEmail));
  };

  const handleForgotPassword = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError(copy.enterEmailBeforeReset);
      return;
    }
    setResetLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setResetSent(true);
      }
    } catch {
      setError(copy.resetSendFailed);
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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

        <form onSubmit={handleLogin} className="space-y-4">
          {emailVerified && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <p className="font-medium">{copy.emailVerifiedTitle}</p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                {copy.emailVerifiedBody}
              </p>
            </div>
          )}
          {showVerifyBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">{copy.verifyBannerTitle}</p>
              <p className="mt-1 text-amber-700">
                {verifyMessage ?? copy.verifyBannerFallback}
              </p>
              {resendStatus === "sent" && (
                <p className="mt-2 text-emerald-700">
                  {copy.verificationEmailSent}
                </p>
              )}
              {resendError && (
                <p className="mt-2 text-red-600">{resendError}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={resendStatus === "sending"}
                >
                  {resendStatus === "sending" ? copy.sending : copy.resendLink}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowVerifyBanner(false)}
                >
                  {copy.dismiss}
                </Button>
              </div>
            </div>
          )}
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
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {resetLoading ? copy.sending : copy.forgotPassword}
            </button>
          </div>

          {resetSent && (
            <div className="rounded-lg border border-border/80 bg-card/70 p-3 text-sm text-muted-foreground backdrop-blur-sm">
              {copy.resetSentPrefix} <span className="font-medium text-foreground">{email}</span>.
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? copy.signingIn : copy.signIn}
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
          onClick={handleGoogleLogin}
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
          {copy.noAccount}{" "}
          <Link href="/auth/signup" className="font-medium text-zinc-900 dark:text-white">
            {copy.signUp}
          </Link>
        </p>
      </div>
    </div>
  );
}
