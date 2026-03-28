"use client";

import type { ChecklistCardPayload, ComparisonCardPayload, StepsCardPayload } from "@/lib/types/cards";
import { ChecklistCard } from "@/components/chat/smart-cards/checklist-card";
import { ComparisonCard } from "@/components/chat/smart-cards/comparison-card";
import { StepsCard } from "@/components/chat/smart-cards/steps-card";

type SupportedSmartCard = ComparisonCardPayload | StepsCardPayload | ChecklistCardPayload;

export interface SmartCardProps {
  type?: string;
  title?: string;
  data?: unknown;
}

export function SmartCard({ type, title, data }: SmartCardProps) {
  const card = normalizeSmartCard({ type, title, data });

  if (!card) {
    return null;
  }

  switch (card.type) {
    case "comparison":
      return (
        <ComparisonCard
          title={card.data.title}
          items={card.data.items}
          verdict={card.data.verdict}
        />
      );
    case "steps":
      return <StepsCard title={card.data.title} steps={card.data.steps} />;
    case "checklist":
      return <ChecklistCard title={card.data.title} groups={card.data.groups} />;
    default:
      return null;
  }
}

function normalizeSmartCard(input: SmartCardProps): SupportedSmartCard | null {
  if (!input.type || !input.data || typeof input.data !== "object" || Array.isArray(input.data)) {
    return null;
  }

  const record = input.data as Record<string, unknown>;
  const resolvedTitle =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : typeof input.title === "string" && input.title.trim()
        ? input.title.trim()
        : "";

  if (!resolvedTitle) {
    return null;
  }

  switch (input.type) {
    case "comparison": {
      const items = Array.isArray(record.items)
        ? record.items.filter(isComparisonItem)
        : [];

      if (items.length < 2) {
        return null;
      }

      return {
        type: "comparison",
        data: {
          title: resolvedTitle,
          items,
          verdict: typeof record.verdict === "string" ? record.verdict : undefined,
        },
      };
    }
    case "steps": {
      const steps = Array.isArray(record.steps)
        ? record.steps.filter(isStepsItem)
        : [];

      if (!steps.length) {
        return null;
      }

      return {
        type: "steps",
        data: {
          title: resolvedTitle,
          steps,
        },
      };
    }
    case "checklist": {
      const groups = Array.isArray(record.groups)
        ? record.groups.filter(isChecklistGroup)
        : [];

      if (!groups.length) {
        return null;
      }

      return {
        type: "checklist",
        data: {
          title: resolvedTitle,
          groups,
        },
      };
    }
    default:
      return null;
  }
}

function isComparisonItem(value: unknown): value is ComparisonCardPayload["data"]["items"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return typeof (value as { name?: unknown }).name === "string";
}

function isStepsItem(value: unknown): value is StepsCardPayload["data"]["steps"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return typeof (value as { title?: unknown }).title === "string";
}

function isChecklistGroup(value: unknown): value is ChecklistCardPayload["data"]["groups"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const group = value as { name?: unknown; items?: unknown };
  return typeof group.name === "string" && Array.isArray(group.items);
}
