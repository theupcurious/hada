import Link from "next/link";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, normalizeLocale, type AppLocale } from "@/lib/i18n";

type ErrorPageProps = {
  searchParams?: Promise<{
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const copy = AUTH_ERROR_COPY[locale];
  const resolvedParams = await searchParams;
  const errorDescription = resolvedParams?.error_description
    ? decodeURIComponent(resolvedParams.error_description)
    : null;
  const errorCode = resolvedParams?.error_code ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {copy.description}
          </p>
        </div>

        {(errorCode || errorDescription) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {errorCode && (
              <p className="font-medium">{copy.errorCodePrefix}: {errorCode}</p>
            )}
            {errorDescription && (
              <p className="mt-1 text-amber-800">{errorDescription}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/login?verify=1"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            {copy.resendLink}
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            {copy.backToSignup}
          </Link>
        </div>
      </div>
    </div>
  );
}

const AUTH_ERROR_COPY: Record<
  AppLocale,
  {
    title: string;
    description: string;
    errorCodePrefix: string;
    resendLink: string;
    backToSignup: string;
  }
> = {
  en: {
    title: "We couldn't verify that link",
    description: "The verification link may be expired or already used. Request a new one below.",
    errorCodePrefix: "Error code",
    resendLink: "Resend verification link",
    backToSignup: "Back to sign up",
  },
  ko: {
    title: "인증 링크를 확인할 수 없어요",
    description: "인증 링크가 만료되었거나 이미 사용되었을 수 있습니다. 아래에서 새 링크를 요청하세요.",
    errorCodePrefix: "오류 코드",
    resendLink: "인증 링크 다시 보내기",
    backToSignup: "회원가입으로 돌아가기",
  },
  ja: {
    title: "このリンクを確認できませんでした",
    description: "確認リンクの有効期限切れ、または既に使用済みの可能性があります。下から再送してください。",
    errorCodePrefix: "エラーコード",
    resendLink: "確認リンクを再送",
    backToSignup: "登録に戻る",
  },
  zh: {
    title: "无法验证这个链接",
    description: "该验证链接可能已过期或已被使用。你可以在下方重新请求一个新链接。",
    errorCodePrefix: "错误代码",
    resendLink: "重新发送验证链接",
    backToSignup: "返回注册",
  },
};
