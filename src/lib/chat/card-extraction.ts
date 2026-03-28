import type {
  ChecklistCardGroup,
  ComparisonCardItem,
  RichCard,
  ScheduleBlock,
  StepsCardStep,
} from "@/lib/types/cards";

type ToolResultForExtraction = {
  name: string;
  result: string;
  args?: Record<string, unknown>;
};

export function extractCardsFromToolResults(toolResults: ToolResultForExtraction[]): RichCard[] {
  const cards: RichCard[] = [];

  for (const toolResult of toolResults) {
    const parsed = safeJsonParse(toolResult.result);
    if (parsed == null) {
      continue;
    }

    for (const candidate of getCardCandidates(toolResult.name, parsed)) {
      const normalized = normalizeRichCard(candidate);
      if (normalized) {
        cards.push(normalized);
      }
    }
  }

  return cards;
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getCardCandidates(toolName: string, parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const record = parsed as Record<string, unknown>;

  if (toolName === "render_card" && record.success === false) {
    return [];
  }

  if (record.card) {
    return [record.card];
  }

  if (Array.isArray(record.cards)) {
    return record.cards;
  }

  if (record.type) {
    return [record];
  }

  return [];
}

function normalizeRichCard(value: unknown): RichCard | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";

  switch (type) {
    case "search_results":
      return normalizeSearchResultsCard(record);
    case "schedule_view":
      return normalizeScheduleViewCard(record);
    case "data_table":
      return normalizeDataTableCard(record);
    case "link_preview":
      return normalizeLinkPreviewCard(record);
    case "comparison":
      return normalizeComparisonCard(record);
    case "steps":
      return normalizeStepsCard(record);
    case "checklist":
      return normalizeChecklistCard(record);
    default:
      return null;
  }
}

function normalizeSearchResultsCard(
  record: Record<string, unknown>,
): RichCard | null {
  const data = asRecord(record.data);
  const query = toNonEmptyString(data?.query);
  const results = Array.isArray(data?.results)
    ? data.results
        .map((item) => {
          const normalized = asRecord(item);
          if (!normalized) {
            return null;
          }

          const title = toNonEmptyString(normalized.title);
          const url = toNonEmptyString(normalized.url);
          const snippet = toNonEmptyString(normalized.snippet);

          if (!title || !url || !snippet) {
            return null;
          }

          return {
            title,
            url,
            snippet,
            favicon: toOptionalString(normalized.favicon),
            source: toOptionalString(normalized.source),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  if (!query || results.length === 0) {
    return null;
  }

  return {
    type: "search_results",
    data: {
      query,
      results,
    },
  };
}

function normalizeScheduleViewCard(
  record: Record<string, unknown>,
): RichCard | null {
  const data = asRecord(record.data);
  const title = toNonEmptyString(data?.title);
  const timeframe = toNonEmptyString(data?.timeframe);
  const blocks = Array.isArray(data?.blocks)
    ? data.blocks
        .map((block) => {
          const normalized = asRecord(block);
          if (!normalized) {
            return null;
          }

          const time = toNonEmptyString(normalized.time);
          const blockTitle = toNonEmptyString(normalized.title);
          const blockType = normalized.type;

          if (
            !time ||
            !blockTitle ||
            (blockType !== "event" && blockType !== "suggestion" && blockType !== "free")
          ) {
            return null;
          }

          const type: ScheduleBlock["type"] = blockType;

          return {
            time,
            title: blockTitle,
            type,
            duration: toOptionalString(normalized.duration),
            source: toOptionalString(normalized.source),
          };
        })
        .filter((block): block is NonNullable<typeof block> => Boolean(block))
    : [];

  if (!title || !timeframe || blocks.length === 0) {
    return null;
  }

  return {
    type: "schedule_view",
    data: {
      title,
      timeframe,
      blocks,
    },
  };
}

function normalizeDataTableCard(record: Record<string, unknown>): RichCard | null {
  const data = asRecord(record.data);
  const headers = Array.isArray(data?.headers)
    ? data.headers.map(toNonEmptyString).filter((value): value is string => Boolean(value))
    : [];
  const rows = Array.isArray(data?.rows)
    ? data.rows
        .map((row) =>
          Array.isArray(row)
            ? row.map(toNonEmptyString).filter((value): value is string => Boolean(value))
            : null,
        )
        .filter((row): row is string[] => row != null && row.length > 0)
    : [];

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

  return {
    type: "data_table",
    data: {
      title: toOptionalString(data?.title),
      headers,
      rows,
    },
  };
}

function normalizeLinkPreviewCard(record: Record<string, unknown>): RichCard | null {
  const data = asRecord(record.data);
  const url = toNonEmptyString(data?.url);
  const title = toNonEmptyString(data?.title);

  if (!url || !title) {
    return null;
  }

  return {
    type: "link_preview",
    data: {
      url,
      title,
      description: toOptionalString(data?.description),
      favicon: toOptionalString(data?.favicon),
      image: toOptionalString(data?.image),
    },
  };
}

function normalizeComparisonCard(record: Record<string, unknown>): RichCard | null {
  const data = asRecord(record.data);
  const title = toNonEmptyString(data?.title);
  const items = Array.isArray(data?.items)
    ? data.items
        .map(normalizeComparisonItem)
        .filter((item): item is ComparisonCardItem => Boolean(item))
    : [];

  if (!title || items.length < 2) {
    return null;
  }

  return {
    type: "comparison",
    data: {
      title,
      items,
      verdict: toOptionalString(data?.verdict),
    },
  };
}

function normalizeComparisonItem(value: unknown): ComparisonCardItem | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const name = toNonEmptyString(record.name);

  if (!name) {
    return null;
  }

  const scoresRecord = asRecord(record.scores);
  const scoreEntries = scoresRecord
    ? Object.entries(scoresRecord).flatMap(([key, rawValue]) => {
        const normalizedKey = key.trim();
        const normalizedValue = toFiniteNumber(rawValue);

        return normalizedKey && normalizedValue != null
          ? [[normalizedKey, normalizedValue] as const]
          : [];
      })
    : [];
  const scores = scoreEntries.length
    ? Object.fromEntries(scoreEntries)
    : undefined;

  return {
    name,
    subtitle: toOptionalString(record.subtitle),
    ...(scores && Object.keys(scores).length ? { scores } : {}),
    ...(toStringArray(record.pros).length ? { pros: toStringArray(record.pros) } : {}),
    ...(toStringArray(record.cons).length ? { cons: toStringArray(record.cons) } : {}),
  };
}

function normalizeStepsCard(record: Record<string, unknown>): RichCard | null {
  const data = asRecord(record.data);
  const title = toNonEmptyString(data?.title);
  const steps = Array.isArray(data?.steps)
    ? data.steps
        .map(normalizeStepItem)
        .filter((step): step is StepsCardStep => Boolean(step))
    : [];

  if (!title || steps.length === 0) {
    return null;
  }

  return {
    type: "steps",
    data: {
      title,
      steps,
    },
  };
}

function normalizeStepItem(value: unknown): StepsCardStep | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const title = toNonEmptyString(record.title);

  if (!title) {
    return null;
  }

  return {
    title,
    detail: toOptionalString(record.detail),
    time: toOptionalString(record.time),
  };
}

function normalizeChecklistCard(record: Record<string, unknown>): RichCard | null {
  const data = asRecord(record.data);
  const title = toNonEmptyString(data?.title);
  const groups = Array.isArray(data?.groups)
    ? data.groups
        .map(normalizeChecklistGroup)
        .filter((group): group is ChecklistCardGroup => Boolean(group))
    : [];

  if (!title || groups.length === 0) {
    return null;
  }

  return {
    type: "checklist",
    data: {
      title,
      groups,
    },
  };
}

function normalizeChecklistGroup(value: unknown): ChecklistCardGroup | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const name = toNonEmptyString(record.name);
  const items = toStringArray(record.items);

  if (!name || items.length === 0) {
    return null;
  }

  return { name, items };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toOptionalString(value: unknown): string | undefined {
  const normalized = toNonEmptyString(value);
  return normalized || undefined;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(toNonEmptyString).filter((item): item is string => Boolean(item))
    : [];
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}
