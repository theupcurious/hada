import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/telegram/client";
import { markdownToTelegramMarkdownV2 } from "@/lib/telegram/format";
import { getTelegramChatIdForUser } from "@/lib/telegram/linking";

export async function sendTelegramToUser(options: {
  supabase: SupabaseClient;
  userId: string;
  text: string;
}): Promise<boolean> {
  const chatId = await getTelegramChatIdForUser({
    supabase: options.supabase,
    userId: options.userId,
  });

  if (!chatId) {
    return false;
  }

  await sendMessage({
    chatId,
    text: markdownToTelegramMarkdownV2(options.text),
    parseMode: "MarkdownV2",
    disableWebPagePreview: true,
  });

  return true;
}
