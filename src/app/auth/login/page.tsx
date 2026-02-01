import { Suspense } from "react";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-4">
        <div className="h-6 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-10 w-full rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-10 w-full rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
