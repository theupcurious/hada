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

export type RichCard =
  | SearchResultsCardPayload
  | ScheduleViewCardPayload
  | DataTableCardPayload
  | LinkPreviewCardPayload;
