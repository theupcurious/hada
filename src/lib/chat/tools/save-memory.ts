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
      scope: {
        type: "string",
        enum: ["space", "global"],
        description:
          "Where this fact belongs. 'space' (default) keeps it to the current space only — use for facts specific to this space's topic. 'global' makes it visible in every space — use for durable personal facts (diet, timezone, working style). In the General space both behave the same.",
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

      // A "global" fact (project_id NULL) is visible in every space; a
      // "space" fact stays in the active space. In General there is no active
      // space, so both collapse to global. We can't use PostgREST upsert here:
      // onConflict only accepts a column list and our uniqueness is on the
      // coalesce(project_id, sentinel) expression, so resolve the row by hand.
      const scopeGlobal = String(args.scope || "").toLowerCase() === "global";
      const targetProjectId = scopeGlobal ? null : context.projectId ?? null;

      const embedding = await generateEmbedding(`${topic}: ${content}`);
      const embeddingJson = embedding ? JSON.stringify(embedding) : null;

      const findExisting = context.supabase
        .from("user_memories")
        .select("id")
        .eq("user_id", context.userId)
        .eq("topic", topic);
      const { data: existing } = await (targetProjectId
        ? findExisting.eq("project_id", targetProjectId)
        : findExisting.is("project_id", null)
      ).maybeSingle();

      if (existing?.id) {
        const { error } = await context.supabase
          .from("user_memories")
          .update({
            content,
            embedding: embeddingJson,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) {
          return JSON.stringify({ success: false, error: error.message });
        }
        return JSON.stringify({ success: true, topic, content });
      }

      const { error: insertError } = await context.supabase.from("user_memories").insert({
        user_id: context.userId,
        project_id: targetProjectId,
        topic,
        content,
        embedding: embeddingJson,
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        // Lost a race to a concurrent insert on the same (user, space, topic).
        // The unique index rejected us (23505); fall back to updating that row.
        if (insertError.code === "23505") {
          const retry = context.supabase
            .from("user_memories")
            .update({ content, embedding: embeddingJson, updated_at: new Date().toISOString() })
            .eq("user_id", context.userId)
            .eq("topic", topic);
          const { error: retryError } = await (targetProjectId
            ? retry.eq("project_id", targetProjectId)
            : retry.is("project_id", null));
          if (retryError) {
            return JSON.stringify({ success: false, error: retryError.message });
          }
          return JSON.stringify({ success: true, topic, content });
        }
        return JSON.stringify({ success: false, error: insertError.message });
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
