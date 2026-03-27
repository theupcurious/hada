import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/chat/embeddings";
import { callLLM, type ProviderSelection } from "@/lib/chat/providers";

/**
 * Extract durable user memories from a single conversation turn.
 * This runs after the response is already available, so failures are silent.
 */
export async function extractMemoriesFromTurn(options: {
  supabase: SupabaseClient;
  userId: string;
  provider: ProviderSelection;
  userMessage: string;
  assistantResponse: string;
}): Promise<void> {
  const userMessage = options.userMessage.trim();
  const assistantResponse = options.assistantResponse.trim();

  if (userMessage.length < 20 && assistantResponse.length < 50) {
    return;
  }

  const { data: existing } = await options.supabase
    .from("user_memories")
    .select("topic, content")
    .eq("user_id", options.userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const existingMemories = (existing || []) as Array<{ topic: string; content: string }>;
  const existingSection = existingMemories.length
    ? existingMemories.map((memory) => `- ${memory.topic}: ${memory.content}`).join("\n")
    : "None yet.";

  const turn = `USER: ${userMessage}\n\nASSISTANT: ${assistantResponse}`;

  let extraction = "";
  try {
    const result = await callLLM({
      selection: options.provider,
      tools: [],
      messages: [
        {
          role: "system",
          content: `You extract NEW durable user facts from a single conversation turn. Output ONLY a JSON array of {topic, content} objects. Rules:
- Only extract facts the user revealed about themselves: preferences, habits, identity, constraints, plans, relationships.
- Do NOT extract anything the assistant said unless the user confirmed it.
- Do NOT duplicate existing memories (listed below). Only extract genuinely new information.
- Do NOT extract task outputs, research results, or ephemeral information.
- Topics are short kebab-case keys (e.g. "location", "work-schedule", "dietary-restrictions").
- Content is 1-2 sentences max, plain text.
- If nothing new is found, output: []

Existing memories:
${existingSection}`,
        },
        {
          role: "user",
          content: turn,
        },
      ],
    });

    extraction = result.content.trim();
  } catch {
    return;
  }

  let memories: Array<{ topic: string; content: string }> = [];
  try {
    const jsonMatch = extraction.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) {
      return;
    }

    memories = parsed as Array<{ topic: string; content: string }>;
  } catch {
    return;
  }

  const toSave = memories
    .filter(
      (memory) =>
        typeof memory?.topic === "string" &&
        typeof memory?.content === "string" &&
        memory.topic.trim().length > 0 &&
        memory.content.trim().length > 0 &&
        memory.topic.trim().length <= 60 &&
        memory.content.trim().length <= 500,
    )
    .slice(0, 3);

  for (const memory of toSave) {
    const embedding = await generateEmbedding(`${memory.topic.trim()}: ${memory.content.trim()}`);
    await options.supabase.from("user_memories").upsert(
      {
        user_id: options.userId,
        topic: memory.topic.trim(),
        content: memory.content.trim(),
        embedding: embedding ? JSON.stringify(embedding) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic" },
    );
  }
}
