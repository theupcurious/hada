const TELEGRAM_API_BASE = "https://api.telegram.org";

interface TelegramResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  return token;
}

async function callTelegram<T = unknown>(method: string, payload: Record<string, unknown>) {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Telegram API request failed (${response.status})`);
  }

  const data = (await response.json()) as TelegramResponse<T>;
  if (!data.ok) {
    throw new Error(data.description || "Telegram API returned an error");
  }

  return data.result as T;
}

export async function sendMessage(options: {
  chatId: string | number;
  text: string;
  parseMode?: "MarkdownV2";
  disableWebPagePreview?: boolean;
}): Promise<{ message_id: number }> {
  return callTelegram<{ message_id: number }>("sendMessage", {
    chat_id: options.chatId,
    text: options.text,
    parse_mode: options.parseMode,
    disable_web_page_preview: options.disableWebPagePreview,
  });
}

export async function editMessageText(options: {
  chatId: string | number;
  messageId: number;
  text: string;
  parseMode?: "MarkdownV2";
  disableWebPagePreview?: boolean;
}): Promise<void> {
  await callTelegram("editMessageText", {
    chat_id: options.chatId,
    message_id: options.messageId,
    text: options.text,
    parse_mode: options.parseMode,
    disable_web_page_preview: options.disableWebPagePreview,
  });
}

export async function setWebhook(options: {
  url: string;
  secretToken: string;
}): Promise<void> {
  await callTelegram("setWebhook", {
    url: options.url,
    secret_token: options.secretToken,
    allowed_updates: ["message"],
  });
}
