import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/chat/process-message";
import { createAdminClient } from "@/lib/supabase/server";
import { editMessageText, sendMessage } from "@/lib/telegram/client";
import { markdownToTelegramMarkdownV2 } from "@/lib/telegram/format";
import {
  consumeTelegramLinkToken,
  getUserIdByTelegramChatId,
  linkTelegramChat,
} from "@/lib/telegram/linking";
import type { AgentEvent } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const message = payload?.message;
    const chatId = message?.chat?.id;
    const text = typeof message?.text === "string" ? message.text.trim() : "";

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    const chatIdString = String(chatId);
    const admin = createAdminClient();

    if (text.startsWith("/start")) {
      await handleStartCommand(admin, chatIdString, text);
      return NextResponse.json({ ok: true });
    }

    const userId = await getUserIdByTelegramChatId({
      supabase: admin,
      chatId: chatIdString,
    });

    if (!userId) {
      await sendMessage({
        chatId,
        text: markdownToTelegramMarkdownV2(
          "Please link your account first in Hada settings: https://hada.app/settings",
        ),
        parseMode: "MarkdownV2",
      });
      return NextResponse.json({ ok: true });
    }

    if (!text) {
      await sendMessage({
        chatId,
        text: markdownToTelegramMarkdownV2("I can only process text messages right now."),
        parseMode: "MarkdownV2",
      });
      return NextResponse.json({ ok: true });
    }

    const live = createLiveEditor(chatId);

    const result = await processMessage({
      userId,
      message: text,
      source: "telegram",
      supabase: admin,
      onEvent: (event) => live.onEvent(event),
    });

    await live.finalize(result.response);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function handleStartCommand(
  admin: SupabaseClient,
  chatId: string,
  text: string,
): Promise<void> {
  const token = text.split(" ")[1]?.trim();

  if (!token) {
    await sendMessage({
      chatId,
      text: markdownToTelegramMarkdownV2(
        "Hi! Open Hada settings and tap Connect Telegram to link this chat.",
      ),
      parseMode: "MarkdownV2",
    });
    return;
  }

  const consumed = await consumeTelegramLinkToken({
    supabase: admin,
    token,
  });

  if (!consumed) {
    await sendMessage({
      chatId,
      text: markdownToTelegramMarkdownV2(
        "That link token is invalid or expired. Generate a new one in Hada settings.",
      ),
      parseMode: "MarkdownV2",
    });
    return;
  }

  await linkTelegramChat({
    supabase: admin,
    userId: consumed.userId,
    chatId,
  });

  await sendMessage({
    chatId,
    text: markdownToTelegramMarkdownV2(
      "Linked to your Hada account! You can now message me here.",
    ),
    parseMode: "MarkdownV2",
  });
}

function createLiveEditor(chatId: string | number) {
  let buffer = "";
  let telegramMessageId: number | null = null;
  let lastEditAt = 0;
  let lastSentText = "";

  const sendOrEdit = async (force = false) => {
    const now = Date.now();
    if (!buffer.trim()) {
      return;
    }

    if (!force && now - lastEditAt < 1100) {
      return;
    }

    const text = markdownToTelegramMarkdownV2(buffer);
    if (text === lastSentText) {
      return;
    }

    if (!telegramMessageId) {
      const sent = await sendMessage({
        chatId,
        text,
        parseMode: "MarkdownV2",
        disableWebPagePreview: true,
      });
      telegramMessageId = sent.message_id;
    } else {
      try {
        await editMessageText({
          chatId,
          messageId: telegramMessageId,
          text,
          parseMode: "MarkdownV2",
          disableWebPagePreview: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.toLowerCase().includes("message is not modified")) {
          console.error("Telegram edit error", error);
        }
      }
    }

    lastEditAt = now;
    lastSentText = text;
  };

  return {
    async onEvent(event: AgentEvent) {
      if (event.type === "text_delta") {
        buffer += event.content;
        await sendOrEdit(false);
      }

      if (event.type === "tool_call") {
        buffer = `${buffer}\n\n_${event.name.replace(/_/g, " ")}..._`;
        await sendOrEdit(false);
      }

      if (event.type === "error") {
        buffer = event.message;
        await sendOrEdit(true);
      }
    },
    async finalize(finalText: string) {
      if (!buffer.trim()) {
        buffer = finalText;
      } else {
        buffer = finalText;
      }
      await sendOrEdit(true);
    },
  };
}
