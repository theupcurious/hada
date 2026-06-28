import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import { ensureValidGoogleToken } from "@/lib/google/tokens";
import { createDraft, getMessage, searchMessages, sendMessage } from "@/lib/google/gmail";

export const gmailSearchManifest: ToolManifest = {
  name: "gmail_search",
  displayName: "Email Search",
  description:
    "Search the user's Gmail using a Gmail query (e.g. 'is:unread', 'from:alice@x.com newer_than:7d'). Returns message summaries with ids for gmail_read.",
  category: "communication",
  riskLevel: "low",
  requiresIntegration: "google",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Gmail search query. Empty matches the latest messages." },
      max_results: { type: "number", description: "Maximum messages to return (default 10, max 25)." },
    },
    required: [],
  },
};

export const gmailReadManifest: ToolManifest = {
  name: "gmail_read",
  displayName: "Email Read",
  description: "Read the full content of a single Gmail message by its id (from gmail_search).",
  category: "communication",
  riskLevel: "low",
  requiresIntegration: "google",
  parameters: {
    type: "object",
    properties: {
      message_id: { type: "string", description: "The Gmail message id." },
    },
    required: ["message_id"],
  },
};

export const gmailDraftManifest: ToolManifest = {
  name: "gmail_draft",
  displayName: "Email Draft",
  description:
    "Create a Gmail draft (not sent). Use when the user wants to review before sending or asked for a draft.",
  category: "communication",
  riskLevel: "medium",
  requiresIntegration: "google",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address(es), comma-separated." },
      subject: { type: "string", description: "Email subject." },
      body: { type: "string", description: "Plain-text email body." },
      cc: { type: "string", description: "Optional CC addresses." },
      bcc: { type: "string", description: "Optional BCC addresses." },
    },
    required: ["to", "subject", "body"],
  },
};

export const gmailSendManifest: ToolManifest = {
  name: "gmail_send",
  displayName: "Email Send",
  description:
    "Send an email from the user's Gmail. This delivers immediately, so only call it when the user clearly wants to send.",
  category: "communication",
  riskLevel: "high",
  requiresIntegration: "google",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address(es), comma-separated." },
      subject: { type: "string", description: "Email subject." },
      body: { type: "string", description: "Plain-text email body." },
      cc: { type: "string", description: "Optional CC addresses." },
      bcc: { type: "string", description: "Optional BCC addresses." },
    },
    required: ["to", "subject", "body"],
  },
};

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function notConnected(): string {
  return stringify({ success: false, error: "Google account not connected or token expired." });
}

function readEmailArgs(args: Record<string, unknown>) {
  return {
    to: String(args.to || "").trim(),
    subject: String(args.subject || "").trim(),
    body: String(args.body || args.message || "").trim(),
    cc: typeof args.cc === "string" && args.cc.trim() ? args.cc.trim() : undefined,
    bcc: typeof args.bcc === "string" && args.bcc.trim() ? args.bcc.trim() : undefined,
  };
}

export function createGmailTools(context: ToolContext): AgentTool[] {
  const token = () => ensureValidGoogleToken(context.userId, context.supabase);

  return [
    {
      name: gmailSearchManifest.name,
      description: gmailSearchManifest.description,
      parameters: gmailSearchManifest.parameters,
      async execute(args) {
        const accessToken = await token();
        if (!accessToken) return notConnected();
        const query = typeof args.query === "string" ? args.query : "";
        const maxResults = Number(args.max_results || args.maxResults || 10) || 10;
        try {
          const messages = await searchMessages(accessToken, query, maxResults);
          return stringify({ success: true, count: messages.length, messages });
        } catch (error) {
          return stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to search email",
          });
        }
      },
    },
    {
      name: gmailReadManifest.name,
      description: gmailReadManifest.description,
      parameters: gmailReadManifest.parameters,
      async execute(args) {
        const accessToken = await token();
        if (!accessToken) return notConnected();
        const messageId = String(args.message_id || args.messageId || args.id || "").trim();
        if (!messageId) return stringify({ success: false, error: "message_id is required" });
        try {
          const message = await getMessage(accessToken, messageId);
          return stringify({ success: true, message });
        } catch (error) {
          return stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to read email",
          });
        }
      },
    },
    {
      name: gmailDraftManifest.name,
      description: gmailDraftManifest.description,
      parameters: gmailDraftManifest.parameters,
      async execute(args) {
        const accessToken = await token();
        if (!accessToken) return notConnected();
        const email = readEmailArgs(args);
        if (!email.to || !email.subject || !email.body) {
          return stringify({ success: false, error: "to, subject, and body are required" });
        }
        try {
          const draft = await createDraft(accessToken, email);
          return stringify({ success: true, draft_id: draft.id, message: `Draft created for ${email.to}.` });
        } catch (error) {
          return stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to create draft",
          });
        }
      },
    },
    {
      name: gmailSendManifest.name,
      description: gmailSendManifest.description,
      parameters: gmailSendManifest.parameters,
      async execute(args) {
        const accessToken = await token();
        if (!accessToken) return notConnected();
        const email = readEmailArgs(args);
        if (!email.to || !email.subject || !email.body) {
          return stringify({ success: false, error: "to, subject, and body are required" });
        }
        try {
          const sent = await sendMessage(accessToken, email);
          return stringify({ success: true, message_id: sent.id, message: `Email sent to ${email.to}.` });
        } catch (error) {
          return stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to send email",
          });
        }
      },
    },
  ];
}
