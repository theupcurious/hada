import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageSource } from "@/lib/types/database";

export interface ToolContext {
  userId: string;
  source: MessageSource;
  supabase: SupabaseClient;
  timezone?: string | null;
}
