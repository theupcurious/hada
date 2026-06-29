export interface CalendarEventCardData {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  location?: string;
  attendees?: string[];
  htmlLink?: string;
  hangoutLink?: string;
}

export interface CalendarEventCardPayload {
  type: "calendar_event";
  data?: CalendarEventCardData;
  actions?: string[];
}

export interface CalendarEventsListPayload {
  type: "calendar_events_list";
  data?: {
    events?: CalendarEventCardData[];
  };
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  favicon?: string;
  source?: string;
}

export interface SearchResultsCardPayload {
  type: "search_results";
  data: {
    query: string;
    results: SearchResultItem[];
  };
}

export interface ScheduleBlock {
  time: string;
  title: string;
  duration?: string;
  type: "event" | "suggestion" | "free";
  source?: string;
}

export interface ScheduleViewCardPayload {
  type: "schedule_view";
  data: {
    title: string;
    timeframe: string;
    blocks: ScheduleBlock[];
  };
}

export interface DataTableCardPayload {
  type: "data_table";
  data: {
    title?: string;
    headers: string[];
    rows: string[][];
  };
}

export interface LinkPreviewCardPayload {
  type: "link_preview";
  data: {
    url: string;
    title: string;
    description?: string;
    favicon?: string;
    image?: string;
  };
}

export interface ComparisonCardItem {
  name: string;
  subtitle?: string;
  scores?: Record<string, number>;
  pros?: string[];
  cons?: string[];
}

export interface ComparisonCardPayload {
  type: "comparison";
  data: {
    title: string;
    items: ComparisonCardItem[];
    verdict?: string;
  };
}

export interface StepsCardStep {
  title: string;
  detail?: string;
  time?: string;
}

export interface StepsCardPayload {
  type: "steps";
  data: {
    title: string;
    steps: StepsCardStep[];
  };
}

export interface ChecklistCardGroup {
  name: string;
  items: string[];
}

export interface ChecklistCardPayload {
  type: "checklist";
  data: {
    title: string;
    groups: ChecklistCardGroup[];
  };
}

export type SmartCard =
  | ComparisonCardPayload
  | StepsCardPayload
  | ChecklistCardPayload;

export interface IntegrationErrorCardPayload {
  type: "integration_error";
  data: {
    provider: "google";
    title: string;
    message: string;
    actionLabel: string;
    actionHref: string;
  };
}

export type RichCard =
  | SearchResultsCardPayload
  | ScheduleViewCardPayload
  | DataTableCardPayload
  | LinkPreviewCardPayload
  | IntegrationErrorCardPayload
  | SmartCard;

export type ChatCard =
  | CalendarEventCardPayload
  | CalendarEventsListPayload
  | RichCard
  | {
      type?: string;
      data?: unknown;
      actions?: string[];
    };
