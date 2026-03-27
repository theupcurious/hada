import type { RichCard } from "@/lib/types/cards";

type ToolResultForExtraction = {
  name: string;
  result: string;
  args?: Record<string, unknown>;
};

export function extractCardsFromToolResults(_toolResults: ToolResultForExtraction[]): RichCard[] {
  return [];
}
