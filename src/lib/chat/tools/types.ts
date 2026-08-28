import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool } from "@/lib/chat/agent-loop";
import type { AgentEvent, MessageSource } from "@/lib/types/database";

export interface ToolContext {
  userId: string;
  source: MessageSource;
  supabase: SupabaseClient;
  /** The active space. NULL = General. Scopes memory reads/writes. */
  projectId?: string | null;
  timezone?: string | null;
  onEvent?: (event: AgentEvent) => Promise<void> | void;
  availableTools?: AgentTool[];
}
