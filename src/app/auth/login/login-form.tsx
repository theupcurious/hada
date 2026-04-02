"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
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
        ? `We sent a verification link to ${emailFromQuery}.`
        : "We sent a verification link to your email."
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
      const message = error.message || "Sign in failed";
      setError(message);
      if (message.toLowerCase().includes("confirm") || message.toLowerCase().includes("verified")) {
        setShowVerifyBanner(true);
        setVerifyMessage("Please confirm your email address to continue.");
      }
      setLoading(false);
    } else {
      router.push("/chat");
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setResendError("Enter your email to resend the verification link.");
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
    setVerifyMessage(`We sent a new verification link to ${targetEmail}.`);
  };

  const handleForgotPassword = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("Enter your email address first, then click Forgot password.");
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
      setError("Could not send reset email. Check your internet connection and try again.");
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
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden shadow-lg shadow-teal-500/25">
                <Image src="/hada-logo.png" alt="Hada" width={28} height={28} className="h-7 w-7 object-cover" />
              </div>
            </div>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to continue to Hada
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {emailVerified && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <p className="font-medium">Email verified!</p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                Your email address is confirmed. Sign in to get started.
              </p>
            </div>
          )}
          {showVerifyBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Verify your email to finish signup</p>
              <p className="mt-1 text-amber-700">
                {verifyMessage ?? "Check your inbox for a verification link."}
              </p>
              {resendStatus === "sent" && (
                <p className="mt-2 text-emerald-700">
                  Verification email sent.
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
                  {resendStatus === "sending" ? "Sending..." : "Resend link"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowVerifyBanner(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
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
              {resetLoading ? "Sending..." : "Forgot password?"}
            </button>
          </div>

          {resetSent && (
            <div className="rounded-lg border border-border/80 bg-card/70 p-3 text-sm text-muted-foreground backdrop-blur-sm">
              Check your inbox — we sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-zinc-50 px-3 text-zinc-400 dark:bg-zinc-950">
              or continue with
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
          Continue with Google
        </Button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="font-medium text-zinc-900 dark:text-white">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
