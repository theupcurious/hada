/**
 * Workflow templates — pre-built recurring automations a non-technical user can
 * start in one click. Each template maps to a `scheduled_tasks` row whose
 * `description` is the prompt the agent runs on schedule (via /api/cron).
 *
 * Keep prompts outcome-oriented and self-contained: the scheduled run has no
 * chat context, so the prompt must fully describe the job.
 */

export type WorkflowFrequency = "daily" | "weekdays" | "weekly_monday";

export interface WorkflowTemplate {
  id: string;
  title: string;
  /** One-line description of the outcome, shown on the card. */
  summary: string;
  /** Emoji icon for quick visual scanning. */
  icon: string;
  /** The prompt the scheduled run sends to the agent. */
  prompt: string;
  defaultFrequency: WorkflowFrequency;
  /** Default local time of day, "HH:MM" 24h. */
  defaultTime: string;
  /** Integration provider required for this workflow to work, if any. */
  requiresIntegration?: "google" | "telegram";
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "morning-email-digest",
    title: "Morning email digest",
    summary: "A short summary of your unread email, every morning.",
    icon: "📬",
    prompt:
      "Summarize my unread email from the last 24 hours. Group by sender or topic, flag anything that looks urgent or needs a reply, and keep it to a skimmable list. If there is no unread email, say so briefly.",
    defaultFrequency: "weekdays",
    defaultTime: "08:00",
    requiresIntegration: "google",
  },
  {
    id: "day-ahead-briefing",
    title: "Your day ahead",
    summary: "Today's calendar, conflicts, and what to prep for.",
    icon: "🗓️",
    prompt:
      "Give me a briefing for today. List my calendar events in order, flag any back-to-back meetings or conflicts, and note anything I should prepare for. End with the 3 most important things to focus on today.",
    defaultFrequency: "weekdays",
    defaultTime: "07:30",
    requiresIntegration: "google",
  },
  {
    id: "meeting-prep",
    title: "Meeting prep",
    summary: "Prep notes for your next meeting, before it starts.",
    icon: "🤝",
    prompt:
      "Look at my next meeting on the calendar today. Summarize what it's about, who's attending, and search my recent email for any relevant context or open threads with the attendees. Give me a short prep note.",
    defaultFrequency: "weekdays",
    defaultTime: "08:30",
    requiresIntegration: "google",
  },
  {
    id: "weekly-review",
    title: "Weekly review",
    summary: "A recap of last week and a plan for the week ahead.",
    icon: "📊",
    prompt:
      "Help me run a weekly review. Recap what happened last week based on my calendar, surface anything that slipped, and lay out the upcoming week with the key priorities. Keep it concise and action-oriented.",
    defaultFrequency: "weekly_monday",
    defaultTime: "08:00",
    requiresIntegration: "google",
  },
  {
    id: "follow-up-nudge",
    title: "Follow-up nudge",
    summary: "Catch emails you haven't replied to yet.",
    icon: "↩️",
    prompt:
      "Search my email for messages from the last 7 days that look like they're waiting on a reply from me and that I haven't responded to. List them with sender, subject, and a one-line suggestion for how to respond.",
    defaultFrequency: "weekdays",
    defaultTime: "16:00",
    requiresIntegration: "google",
  },
  {
    id: "industry-scan",
    title: "Industry news scan",
    summary: "A weekly roundup of news in your field.",
    icon: "📰",
    prompt:
      "Search the web for the most important developments this week in my industry and areas I care about (use what you know about me from memory). Give me a brief, sourced roundup of the 5 most relevant items.",
    defaultFrequency: "weekly_monday",
    defaultTime: "09:00",
  },
];

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id);
}

export const WORKFLOW_FREQUENCY_LABELS: Record<WorkflowFrequency, string> = {
  daily: "Every day",
  weekdays: "Weekdays (Mon–Fri)",
  weekly_monday: "Every Monday",
};

/**
 * Convert a local frequency + "HH:MM" time into a UTC 5-field cron expression.
 * The cron evaluator (in /api/cron and the dashboard) matches against UTC, so we
 * convert the local time-of-day to UTC and shift weekdays across any day boundary.
 */
export function localScheduleToCron(
  frequency: WorkflowFrequency,
  time: string,
  timezoneOffsetMinutes: number,
): string {
  const [hStr, mStr] = time.split(":");
  const localHour = clamp(Number(hStr), 0, 23);
  const localMinute = clamp(Number(mStr), 0, 59);
  const localMinutes = localHour * 60 + localMinute;

  // getTimezoneOffset() semantics: UTC = local + offset minutes.
  const totalUtc = localMinutes + timezoneOffsetMinutes;
  const dayShift = Math.floor(totalUtc / 1440);
  const utcMinutesInDay = ((totalUtc % 1440) + 1440) % 1440;
  const utcHour = Math.floor(utcMinutesInDay / 60);
  const utcMinute = utcMinutesInDay % 60;

  if (frequency === "daily") {
    return `${utcMinute} ${utcHour} * * *`;
  }

  const localDays = frequency === "weekdays" ? [1, 2, 3, 4, 5] : [1];
  const utcDays = Array.from(
    new Set(localDays.map((day) => (((day + dayShift) % 7) + 7) % 7)),
  ).sort((a, b) => a - b);

  return `${utcMinute} ${utcHour} * * ${utcDays.join(",")}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
