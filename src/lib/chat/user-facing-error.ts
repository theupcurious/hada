import { QUOTA_EXCEEDED_PREFIX, QUOTA_UNAVAILABLE_PREFIX, stripQuotaPrefix } from "@/lib/usage/plans";

export function describeChatError(details: string): {
  title: string; message: string; settings?: boolean; plan?: boolean;
} {
  // Plan quota errors come first: their wording would otherwise match the
  // provider-limit pattern below and blame the AI provider.
  const trimmed = details.trim();
  if (trimmed.startsWith(QUOTA_EXCEEDED_PREFIX)) return {
    title: "You’ve reached your plan’s monthly limit",
    message: stripQuotaPrefix(trimmed), plan: true,
  };
  if (trimmed.startsWith(QUOTA_UNAVAILABLE_PREFIX)) return {
    title: "Hada couldn’t check your plan usage",
    message: stripQuotaPrefix(trimmed),
  };
  if (/429|rate.?limit|usage limit|quota|credits|token plan/i.test(details)) return {
    title: "The AI provider’s usage limit was reached",
    message: "Check provider availability in Settings, or try again after its limit resets.", settings: true,
  };
  if (/401|403|api.?key|unauthorized|authentication/i.test(details)) return {
    title: "The AI provider couldn’t be reached",
    message: "Check the provider connection in Settings before trying again.", settings: true,
  };
  if (/time.?out|timed out/i.test(details)) return {
    title: "This request took too long",
    message: "Try again, or break the request into a smaller task.",
  };
  return { title: "Hada couldn’t finish this request", message: "Check your connection and try again. Any completed actions may still have taken effect." };
}

export function isChatFailure(content: string): boolean {
  return /^(?:Agent (?:stopped|timed out)|LLM request failed|Tool error:)/i.test(content.trim());
}
