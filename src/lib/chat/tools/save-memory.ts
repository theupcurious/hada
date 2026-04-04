import type { AgentTool } from "@/lib/chat/agent-loop";
import { generateEmbedding } from "@/lib/chat/embeddings";
import type { ToolContext } from "@/lib/chat/tools/types";

import type { ToolManifest } from "@/lib/chat/tools/tool-registry";

const MAX_TOPIC_CHARS = 60;
const MAX_CONTENT_CHARS = 500;
const MAX_SENTENCE_COUNT = 3;

export const saveMemoryManifest: ToolManifest = {
  name: "save_memory",
  displayName: "Save Memory",
  description: "Save or update long-term memory for this user under a concise topic key.",
  category: "memory",
  riskLevel: "medium",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Short stable topic key, e.g. 'work-hours' or 'travel-preferences'.",
      },
      content: {
        type: "string",
        description: "Concise memory content to store (up to 500 characters).",
      },
    },
    required: ["topic", "content"],
  },
};

export function createSaveMemoryTool(context: ToolContext): AgentTool {
  return {
    name: saveMemoryManifest.name,
    description: saveMemoryManifest.description,
    parameters: saveMemoryManifest.parameters,
    async execute(args) {
      const topic = normalizeMemoryField(String(args.topic || ""));
      const content = normalizeMemoryField(String(args.content || ""));

      if (!topic || !content) {
        return JSON.stringify({ success: false, error: "topic and content are required" });
      }

      const validationError = validateMemoryCandidate(topic, content);
      if (validationError) {
        return JSON.stringify({ success: false, error: validationError });
      }

      const embedding = await generateEmbedding(`${topic}: ${content}`);
      const { error } = await context.supabase.from("user_memories").upsert(
        {
          user_id: context.userId,
          topic,
          content,
          embedding: embedding ? JSON.stringify(embedding) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,topic" },
      );

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      return JSON.stringify({ success: true, topic, content });
    },
  };
}

function normalizeMemoryField(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function validateMemoryCandidate(topic: string, content: string): string | null {
  if (topic.length > MAX_TOPIC_CHARS) {
    return "Memory topic is too long. Save a short stable topic key.";
  }

  if (content.length > MAX_CONTENT_CHARS) {
    return "Memory content is too long. Save a single concise fact or preference instead.";
  }

  if (countSentences(content) > MAX_SENTENCE_COUNT) {
    return "Memory content should be a short durable fact, not a multi-part summary.";
  }

  if (containsStructuredSummaryFormatting(topic) || containsStructuredSummaryFormatting(content)) {
    return "Do not save formatted summaries, lists, or research notes as memory.";
  }

  if (looksLikeResearchArtifact(topic, content)) {
    return "This looks like research output, not durable user memory.";
  }

  return null;
}

function countSentences(value: string): number {
  return value
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function containsStructuredSummaryFormatting(value: string): boolean {
  if (!value) {
    return false;
  }

  return (
    /[#*`]/.test(value) ||
    /(?:^| )\d+\./.test(value) ||
    /(?:^| )[-*•]\s/.test(value) ||
    /\bhttps?:\/\//i.test(value) ||
    /\b(?:pros|cons|price|pricing|honorable mentions)\b/i.test(value)
  );
}

function looksLikeResearchArtifact(topic: string, content: string): boolean {
  const combined = `${topic} ${content}`.toLowerCase();

  const researchSignals = [
    "top 3",
    "top 5",
    "best ",
    "comparison",
    "compare",
    "versus",
    "vs ",
    "summary",
    "research",
    "market",
    "stock",
    "flight options",
    "price",
    "pricing",
    "project management tools",
    "note-taking apps",
    "apps",
    "tools",
    "recommendation",
  ];

  const durableSignals = [
    "prefers",
    "preference",
    "usually",
    "always",
    "never",
    "timezone",
    "diet",
    "dietary",
    "allergy",
    "likes",
    "dislikes",
    "uses",
    "works",
    "working style",
    "recurring",
    "every ",
    "default",
    "favorite",
  ];

  const hasResearchSignal = researchSignals.some((signal) => combined.includes(signal));
  const hasDurableSignal = durableSignals.some((signal) => combined.includes(signal));

  return hasResearchSignal && !hasDurableSignal;
}
