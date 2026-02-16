import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const LINK_TTL_MINUTES = 10;

export async function createTelegramLinkToken(options: {
  supabase: SupabaseClient;
  userId: string;
  ttlMinutes?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const ttlMinutes = options.ttlMinutes ?? LINK_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  // Invalidate previously issued tokens for this user.
  await options.supabase
    .from("telegram_link_tokens")
    .delete()
    .eq("user_id", options.userId)
    .is("used_at", null);

  const { error } = await options.supabase.from("telegram_link_tokens").insert({
    user_id: options.userId,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create Telegram link token: ${error.message}`);
  }

  return { token, expiresAt };
}

export function buildTelegramDeepLink(token: string): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "HadaBot";
  return `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`;
}

export async function consumeTelegramLinkToken(options: {
  supabase: SupabaseClient;
  token: string;
}): Promise<{ userId: string } | null> {
  const { data, error } = await options.supabase
    .from("telegram_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", options.token)
    .single();

  if (error || !data) {
    return null;
  }

  if (data.used_at) {
    return null;
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  const { error: updateError } = await options.supabase
    .from("telegram_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);

  if (updateError) {
    return null;
  }

  return { userId: data.user_id };
}

export async function linkTelegramChat(options: {
  supabase: SupabaseClient;
  userId: string;
  chatId: string;
}): Promise<void> {
  const { error } = await options.supabase.from("integrations").upsert(
    {
      user_id: options.userId,
      provider: "telegram",
      access_token: options.chatId,
      refresh_token: null,
      expires_at: null,
      scopes: [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    throw new Error(`Failed to link Telegram chat: ${error.message}`);
  }
}

export async function getTelegramChatIdForUser(options: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<string | null> {
  const { data } = await options.supabase
    .from("integrations")
    .select("access_token")
    .eq("user_id", options.userId)
    .eq("provider", "telegram")
    .single();

  return data?.access_token || null;
}

export async function getUserIdByTelegramChatId(options: {
  supabase: SupabaseClient;
  chatId: string;
}): Promise<string | null> {
  const { data } = await options.supabase
    .from("integrations")
    .select("user_id")
    .eq("provider", "telegram")
    .eq("access_token", options.chatId)
    .single();

  return data?.user_id || null;
}
