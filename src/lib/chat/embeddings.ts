const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_EMBEDDING_BASE_URL = "https://api.openai.com/v1";

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const input = text.trim();
  if (!input) {
    return null;
  }

  // Use EMBEDDING_API_KEY, fall back to LLM_API_KEY, then OPENAI_API_KEY
  const apiKey =
    process.env.EMBEDDING_API_KEY ||
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!apiKey) {
    return null;
  }

  const baseUrl = (
    process.env.EMBEDDING_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    DEFAULT_EMBEDDING_BASE_URL
  ).replace(/\/+$/, "");

  const model = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const dimensions = DEFAULT_EMBEDDING_DIMENSIONS;

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input, model, dimensions }),
    });

    if (!response.ok) {
      console.error("Embedding API error:", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };

    const embedding = data.data?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    return null;
  }
}
