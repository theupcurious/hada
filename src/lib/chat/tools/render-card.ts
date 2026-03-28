import type { AgentTool } from "@/lib/chat/agent-loop";
import type { ToolContext } from "@/lib/chat/tools/types";
import type { ToolManifest } from "@/lib/chat/tools/tool-registry";
import type {
  ChecklistCardPayload,
  ComparisonCardPayload,
  StepsCardPayload,
} from "@/lib/types/cards";

type SmartCardPayload = ComparisonCardPayload | StepsCardPayload | ChecklistCardPayload;
type SupportedCardType = SmartCardPayload["type"];

export const renderCardManifest: ToolManifest = {
  name: "render_card",
  displayName: "Render Card",
  description:
    "Render a structured smart card for comparisons, step-by-step plans, and checklists. Always include a brief text response alongside the card.",
  category: "custom",
  riskLevel: "low",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["comparison", "steps", "checklist"],
        description: "The smart card type to render.",
      },
      title: {
        type: "string",
        description: "Card title. Required for every smart card.",
      },
      data: {
        type: "object",
        description:
          "Optional nested card payload. You may also provide the type-specific fields at the top level.",
      },
      items: {
        type: "array",
        description: "Comparison items. Use for comparison cards.",
        items: { type: "object" },
      },
      verdict: {
        type: "string",
        description: "Optional summary verdict for a comparison card.",
      },
      steps: {
        type: "array",
        description: "Ordered steps. Use for steps cards.",
        items: { type: "object" },
      },
      groups: {
        type: "array",
        description: "Checklist groups with item arrays. Use for checklist cards.",
        items: { type: "object" },
      },
    },
    required: ["type", "title"],
  },
};

export function createRenderCardTool(context: ToolContext): AgentTool {
  void context;

  return {
    name: renderCardManifest.name,
    description: renderCardManifest.description,
    parameters: renderCardManifest.parameters,
    async execute(args) {
      const normalized = normalizeSmartCardArgs(args);

      if (!normalized) {
        return JSON.stringify({
          success: false,
          error:
            "Invalid card payload. Supported cards are comparison, steps, and checklist, and each requires a title plus valid type-specific content.",
        });
      }

      return JSON.stringify({
        success: true,
        card: normalized,
      });
    },
  };
}

function normalizeSmartCardArgs(args: Record<string, unknown>): SmartCardPayload | null {
  const type = typeof args.type === "string" ? args.type.trim() : "";
  const title = typeof args.title === "string" ? args.title.trim() : "";
  const data = asRecord(args.data);

  if (!title || !isSupportedCardType(type)) {
    return null;
  }

  switch (type) {
    case "comparison":
      return normalizeComparisonCard(title, args, data);
    case "steps":
      return normalizeStepsCard(title, args, data);
    case "checklist":
      return normalizeChecklistCard(title, args, data);
  }
}

function normalizeComparisonCard(
  title: string,
  args: Record<string, unknown>,
  data: Record<string, unknown> | null,
): ComparisonCardPayload | null {
  const source = data ?? args;
  const items = Array.isArray(source.items)
    ? source.items
        .map(normalizeComparisonItem)
        .filter((item): item is ComparisonCardPayload["data"]["items"][number] => Boolean(item))
    : [];

  if (items.length < 2) {
    return null;
  }

  return {
    type: "comparison",
    data: {
      title,
      items,
      ...(optionalString(source.verdict) ? { verdict: optionalString(source.verdict) } : {}),
    },
  };
}

function normalizeComparisonItem(
  value: unknown,
): ComparisonCardPayload["data"]["items"][number] | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const name = requiredString(record.name);

  if (!name) {
    return null;
  }

  const scoresRecord = asRecord(record.scores);
  const scoreEntries = scoresRecord
    ? Object.entries(scoresRecord).flatMap(([key, rawValue]) => {
        const normalizedKey = key.trim();
        const normalizedValue = finiteNumber(rawValue);

        return normalizedKey && normalizedValue != null
          ? [[normalizedKey, normalizedValue] as const]
          : [];
      })
    : [];
  const scores = scoreEntries.length
    ? Object.fromEntries(scoreEntries)
    : undefined;
  const pros = stringArray(record.pros);
  const cons = stringArray(record.cons);

  return {
    name,
    ...(optionalString(record.subtitle) ? { subtitle: optionalString(record.subtitle) } : {}),
    ...(scores && Object.keys(scores).length ? { scores } : {}),
    ...(pros.length ? { pros } : {}),
    ...(cons.length ? { cons } : {}),
  };
}

function normalizeStepsCard(
  title: string,
  args: Record<string, unknown>,
  data: Record<string, unknown> | null,
): StepsCardPayload | null {
  const source = data ?? args;
  const steps = Array.isArray(source.steps)
    ? source.steps
        .map(normalizeStep)
        .filter((step): step is StepsCardPayload["data"]["steps"][number] => Boolean(step))
    : [];

  if (!steps.length) {
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

function normalizeStep(value: unknown): StepsCardPayload["data"]["steps"][number] | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const title = requiredString(record.title);

  if (!title) {
    return null;
  }

  return {
    title,
    ...(optionalString(record.detail) ? { detail: optionalString(record.detail) } : {}),
    ...(optionalString(record.time) ? { time: optionalString(record.time) } : {}),
  };
}

function normalizeChecklistCard(
  title: string,
  args: Record<string, unknown>,
  data: Record<string, unknown> | null,
): ChecklistCardPayload | null {
  const source = data ?? args;
  const groups = Array.isArray(source.groups)
    ? source.groups
        .map(normalizeChecklistGroup)
        .filter((group): group is ChecklistCardPayload["data"]["groups"][number] => Boolean(group))
    : [];

  if (!groups.length) {
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

function normalizeChecklistGroup(
  value: unknown,
): ChecklistCardPayload["data"]["groups"][number] | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const name = requiredString(record.name);
  const items = stringArray(record.items);

  if (!name || !items.length) {
    return null;
  }

  return { name, items };
}

function isSupportedCardType(value: string): value is SupportedCardType {
  return value === "comparison" || value === "steps" || value === "checklist";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | undefined {
  const normalized = requiredString(value);
  return normalized || undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(requiredString).filter((item): item is string => Boolean(item))
    : [];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
