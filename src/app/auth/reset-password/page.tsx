"use client";

export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResolvedLocale } from "@/lib/hooks/use-resolved-locale";
import type { AppLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const RESET_COPY: Record<
  AppLocale,
  {
    passwordsMismatch: string;
    passwordTooShort: string;
    title: string;
    subtitle: string;
    updatedTitle: string;
    redirecting: string;
    newPasswordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    updating: string;
    updatePassword: string;
    backToSignIn: string;
  }
> = {
  en: {
    passwordsMismatch: "Passwords don't match.",
    passwordTooShort: "Password must be at least 6 characters.",
    title: "Set new password",
    subtitle: "Choose a new password for your account.",
    updatedTitle: "Password updated!",
    redirecting: "Taking you to the app…",
    newPasswordPlaceholder: "New password",
    confirmPasswordPlaceholder: "Confirm new password",
    updating: "Updating…",
    updatePassword: "Update password",
    backToSignIn: "Back to sign in",
  },
  ko: {
    passwordsMismatch: "비밀번호가 일치하지 않습니다.",
    passwordTooShort: "비밀번호는 최소 6자 이상이어야 합니다.",
    title: "새 비밀번호 설정",
    subtitle: "계정에 사용할 새 비밀번호를 입력하세요.",
    updatedTitle: "비밀번호가 변경되었습니다!",
    redirecting: "앱으로 이동 중입니다…",
    newPasswordPlaceholder: "새 비밀번호",
    confirmPasswordPlaceholder: "새 비밀번호 확인",
    updating: "업데이트 중…",
    updatePassword: "비밀번호 변경",
    backToSignIn: "로그인으로 돌아가기",
  },
  ja: {
    passwordsMismatch: "パスワードが一致しません。",
    passwordTooShort: "パスワードは6文字以上で入力してください。",
    title: "新しいパスワードを設定",
    subtitle: "アカウントの新しいパスワードを入力してください。",
    updatedTitle: "パスワードを更新しました！",
    redirecting: "アプリへ移動しています…",
    newPasswordPlaceholder: "新しいパスワード",
    confirmPasswordPlaceholder: "新しいパスワード（確認）",
    updating: "更新中…",
    updatePassword: "パスワードを更新",
    backToSignIn: "サインインに戻る",
  },
  zh: {
    passwordsMismatch: "两次输入的密码不一致。",
    passwordTooShort: "密码至少需要 6 个字符。",
    title: "设置新密码",
    subtitle: "为你的账户设置一个新密码。",
    updatedTitle: "密码已更新！",
    redirecting: "正在带你进入应用…",
    newPasswordPlaceholder: "新密码",
    confirmPasswordPlaceholder: "确认新密码",
    updating: "更新中…",
    updatePassword: "更新密码",
    backToSignIn: "返回登录",
  },
};

export default function ResetPasswordPage() {
  const locale = useResolvedLocale();
  const copy = RESET_COPY[locale];
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(copy.passwordsMismatch);
      return;
    }
    if (password.length < 6) {
      setError(copy.passwordTooShort);
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/chat"), 2500);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">H</span>
            </div>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.subtitle}
          </p>
        </div>

        {done ? (
          <div className="rounded-lg border border-border/80 bg-card/70 p-4 text-center text-sm backdrop-blur-sm">
            <p className="font-medium text-foreground">{copy.updatedTitle}</p>
            <p className="mt-1 text-muted-foreground">{copy.redirecting}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder={copy.newPasswordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Input
              type="password"
              placeholder={copy.confirmPasswordPlaceholder}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? copy.updating : copy.updatePassword}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="font-medium text-foreground hover:underline">
            {copy.backToSignIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
