export type UserTier = "free" | "paid" | "pro";
export type PermissionMode = "direct" | "confirm";
export type MessageRole = "user" | "assistant" | "system";
export type MessageSource = "web" | "telegram" | "scheduled";
export type IntegrationProvider = "google" | "microsoft" | "telegram";
export type ScheduledTaskType = "once" | "recurring";
export type LLMProviderName =
  | "minimax"
  | "anthropic"
  | "openai"
  | "gemini"
  | "kimi"
  | "deepseek"
  | "groq";

export interface UserPermissions {
  google_calendar_read?: PermissionMode;
  google_calendar_write?: PermissionMode;
  google_gmail_read?: PermissionMode;
  google_gmail_send?: PermissionMode;
}

export interface UserSettings {
  llm_provider?: LLMProviderName;
  llm_model?: string | null;
  timezone?: string | null;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  tier: UserTier;
  permissions: UserPermissions;
  settings: UserSettings;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  compacted_through: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageMetadata {
  source?: MessageSource;
  type?: "compaction";
  thinking?: string;
  runId?: string;
  gatewayError?: { code: string; message: string };
  cards?: unknown[];
  confirmation?: {
    pending?: boolean;
    function?: {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    confirmationData?: unknown;
    created_at?: string;
    resolved_at?: string;
    cancelled?: boolean;
  };
  [key: string]: unknown;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata: MessageMetadata | null;
  created_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface UserMemory {
  id: string;
  user_id: string;
  topic: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TelegramLinkToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface ScheduledTask {
  id: string;
  user_id: string;
  type: ScheduledTaskType;
  cron_expression: string | null;
  run_at: string | null;
  description: string;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
}

// Chat runtime types
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export type AgentEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          tier?: UserTier;
          permissions?: UserPermissions;
          settings?: UserSettings;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<User, "id" | "created_at">>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          compacted_through?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Conversation, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          conversation_id: string;
          role: MessageRole;
          content: string;
          metadata?: MessageMetadata | null;
          created_at?: string;
        };
        Update: Partial<Omit<Message, "id" | "conversation_id" | "created_at">>;
        Relationships: [];
      };
      integrations: {
        Row: Integration;
        Insert: {
          id?: string;
          user_id: string;
          provider: IntegrationProvider;
          access_token: string;
          refresh_token?: string | null;
          expires_at?: string | null;
          scopes?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Integration, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      user_memories: {
        Row: UserMemory;
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserMemory, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      telegram_link_tokens: {
        Row: TelegramLinkToken;
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<TelegramLinkToken, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      scheduled_tasks: {
        Row: ScheduledTask;
        Insert: {
          id?: string;
          user_id: string;
          type: ScheduledTaskType;
          cron_expression?: string | null;
          run_at?: string | null;
          description: string;
          enabled?: boolean;
          last_run_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<ScheduledTask, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
