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
  | "groq"
  | "openrouter"
  | "mimo";

export type WritingStyle = "concise" | "balanced" | "detailed";
export type RecommendationStyle = "decision_first" | "context_first";
export type PlanningStyle = "daily" | "weekly" | "both";
export type WorkRhythm = "morning_deep_work" | "afternoon_deep_work" | "flexible";
export type AssistantVoice = "pragmatic" | "friendly" | "professional" | "academic";

export interface WorkingStyleSettings {
  writing_style?: WritingStyle;
  recommendation_style?: RecommendationStyle;
  planning_style?: PlanningStyle;
  work_rhythm?: WorkRhythm;
}

export interface AssistantPreferenceSettings {
  primary_goals?: string[];
  calendar_habits?: string[];
  current_projects?: string[];
  voice?: AssistantVoice;
  setup_version?: number;
}

export interface WelcomeStateSettings {
  dismissed_starter_ids?: string[];
}

export interface UserPermissions {
  google_calendar_read?: PermissionMode;
  google_calendar_write?: PermissionMode;
  google_gmail_read?: PermissionMode;
  google_gmail_send?: PermissionMode;
}

export interface UserSettings {
  llm_provider?: LLMProviderName;
  llm_model?: string | null;
  llm_fallback_model?: string | null;
  timezone?: string | null;
  persona?: string;
  custom_instructions?: string | null;
  onboarding_completed?: boolean;
  working_style?: WorkingStyleSettings;
  assistant_preferences?: AssistantPreferenceSettings;
  welcome_state?: WelcomeStateSettings;
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
  backgroundJob?: {
    id?: string;
    status?: "queued" | "running" | "completed" | "failed" | "timeout";
    pending?: boolean;
  };
  followUpSuggestions?: string[];
  feedback?: {
    value?: "up" | "down";
    updated_at?: string;
  };
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
  embedding: string | null;
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

export interface BackgroundJob {
  id: string;
  user_id: string;
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  source: MessageSource;
  request_text: string;
  status: "queued" | "running" | "completed" | "failed" | "timeout";
  processing_token: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackgroundJobEvent {
  id: string;
  job_id: string;
  user_id: string;
  seq: number;
  event: AgentEvent;
  created_at: string;
}

export interface AgentRunToolCall {
  name: string;
  callId: string;
  durationMs: number;
  status: "done" | "error";
}

export interface AgentRun {
  id: string;
  user_id: string;
  conversation_id: string | null;
  source: "web" | "telegram" | "scheduled";
  status: "running" | "completed" | "failed" | "timeout";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  input_preview: string | null;
  output_preview: string | null;
  tool_calls: AgentRunToolCall[];
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  content: string;
  folder: string | null;
  created_at: string;
  updated_at: string;
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

export interface TaskStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "done" | "failed";
  toolsNeeded?: string[];
}

export interface TaskPlan {
  id: string;
  goal?: string;
  steps: TaskStep[];
}

export type AgentEvent =
  | { type: "text_delta"; content: string; agentName?: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; callId: string; agentName?: string }
  | { type: "tool_result"; name: string; result: string; callId: string; durationMs: number; truncated: boolean; agentName?: string }
  | { type: "thinking"; content: string; agentName?: string }
  | { type: "plan_created"; plan: TaskPlan; agentName?: string }
  | { type: "step_started"; stepId: string; planId: string; agentName?: string }
  | { type: "step_completed"; stepId: string; planId: string; result: string; agentName?: string }
  | { type: "step_failed"; stepId: string; planId: string; error: string; agentName?: string }
  | { type: "delegation_started"; agentName: string; task: string }
  | { type: "delegation_completed"; agentName: string; result: string }
  | { type: "done"; content: string; agentName?: string }
  | { type: "message_saved"; id: string }
  | { type: "follow_up_suggestions"; suggestions: string[] }
  | { type: "context_compacted"; removedCount: number }
  | { type: "error"; message: string; agentName?: string }
  | { type: "permission_request"; callId: string; toolName: string; args: Record<string, unknown> }
  | { type: "permission_response"; callId: string; allowed: boolean };

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
          embedding?: string | null;
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
      background_jobs: {
        Row: BackgroundJob;
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          user_message_id: string;
          assistant_message_id: string;
          source: MessageSource;
          request_text: string;
          status?: "queued" | "running" | "completed" | "failed" | "timeout";
          processing_token?: string | null;
          attempts?: number;
          started_at?: string | null;
          finished_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<BackgroundJob, "id" | "user_id" | "conversation_id" | "user_message_id" | "assistant_message_id" | "created_at">>;
        Relationships: [];
      };
      background_job_events: {
        Row: BackgroundJobEvent;
        Insert: {
          id?: string;
          job_id: string;
          user_id: string;
          seq: number;
          event: AgentEvent;
          created_at?: string;
        };
        Update: Partial<Omit<BackgroundJobEvent, "id" | "job_id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      agent_runs: {
        Row: AgentRun;
        Insert: {
          id?: string;
          user_id: string;
          conversation_id?: string | null;
          source?: AgentRun["source"];
          status?: AgentRun["status"];
          started_at?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          input_preview?: string | null;
          output_preview?: string | null;
          tool_calls?: AgentRunToolCall[];
          error?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Omit<AgentRun, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_user_memories: {
        Args: {
          query_embedding: string;
          match_user_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          topic: string;
          content: string;
          updated_at: string;
          similarity: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
