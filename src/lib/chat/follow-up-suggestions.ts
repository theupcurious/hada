import { callLLM, type ProviderSelection } from "@/lib/chat/providers";

export function sanitizeFollowUpSuggestions(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 120)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export async function generateFollowUpSuggestions(options: {
  provider: ProviderSelection;
  userMessage: string;
  assistantResponse: string;
}): Promise<string[]> {
  if (options.assistantResponse.trim().length < 40) {
    return [];
  }

  const result = await callLLM({
    selection: options.provider,
    signal: AbortSignal.timeout(8_000),
    messages: [
      {
        role: "system",
        content:
          "Generate 2 or 3 natural follow-up questions for the user based on the conversation. " +
          "Return only a JSON array of strings. Keep each suggestion concise, specific, and clickable.",
      },
      {
        role: "user",
        content: `USER:\n${options.userMessage}\n\nASSISTANT:\n${options.assistantResponse}`,
      },
    ],
  });

  try {
    const match = result.content.match(/\[[\s\S]*\]/);
    if (!match) {
      return [];
    }

    return sanitizeFollowUpSuggestions(JSON.parse(match[0]));
  } catch {
    return [];
  }
}
