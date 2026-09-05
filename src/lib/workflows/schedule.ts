/**
 * Human-readable schedule helpers for the Workflows UI. Cron expressions are
 * stored in UTC (see localScheduleToCron); these turn them back into friendly
 * schedules and exact next-run times in the viewer's own timezone, so users can
 * review what a workflow will do before creating or while managing it.
 */

/** The viewer's IANA timezone, e.g. "America/New_York". */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** A short timezone label with offset, e.g. "America/New_York (GMT-4)". */
export function getTimeZoneLabel(tz: string = getUserTimeZone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value;
    return offset ? `${tz} (${offset})` : tz;
  } catch {
    return tz;
  }
}

function matchCronField(field: string, value: number): boolean {
  if (field === "*") return true;
  if (field.includes(",")) return field.split(",").some((e) => matchCronField(e.trim(), value));
  if (field.includes("/")) {
    const [base, stepText] = field.split("/");
    const step = Number(stepText);
    if (!Number.isFinite(step) || step <= 0) return false;
    if (base === "*") return value % step === 0;
    const baseNumber = Number(base);
    return Number.isFinite(baseNumber) && value >= baseNumber && (value - baseNumber) % step === 0;
  }
  const exact = Number(field);
  return Number.isFinite(exact) && exact === value;
}

function cronMatches(parts: string[], date: Date): boolean {
  const [minute, hour, day, month, weekday] = parts;
  return (
    matchCronField(minute, date.getUTCMinutes()) &&
    matchCronField(hour, date.getUTCHours()) &&
    matchCronField(day, date.getUTCDate()) &&
    matchCronField(month, date.getUTCMonth() + 1) &&
    matchCronField(weekday, date.getUTCDay())
  );
}

/** The next UTC time (as a Date) a 5-field cron fires, searching up to 90 days. */
export function nextRunFromCron(cron: string, from: Date = new Date()): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const current = new Date(from);
  current.setUTCSeconds(0, 0);
  current.setUTCMinutes(current.getUTCMinutes() + 1);
  const maxChecks = 60 * 24 * 90;
  for (let i = 0; i < maxChecks; i += 1) {
    if (cronMatches(parts, current)) return current;
    current.setUTCMinutes(current.getUTCMinutes() + 1);
  }
  return null;
}

/** Weekday names for friendly recurrence labels (index 0 = Sunday). */
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The local weekday index (0 = Sunday) of a Date in the given timezone. */
function localWeekdayIndex(date: Date, tz: string): number {
  try {
    const short = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
    return WEEKDAY_SHORT.indexOf(short);
  } catch {
    return date.getUTCDay();
  }
}

/**
 * A friendly recurrence phrase for common cron shapes — "Every day",
 * "Weekdays (Mon–Fri)", "Every Monday" — or null when the cron is too complex
 * to summarize (the caller then falls back to showing the raw expression).
 * The weekday set is derived from the *next run's local weekday*, so timezone
 * shifts baked into the UTC cron are reflected correctly.
 */
export function cronRecurrenceLabel(cron: string, tz: string = getUserTimeZone()): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, day, month, weekday] = parts;
  // Only summarize a fixed daily time (single minute/hour, any day-of-month/month).
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour) || day !== "*" || month !== "*") return null;

  if (weekday === "*") return "Every day";

  // Resolve the cron's weekday set to local weekdays via sample runs, so a UTC
  // day-boundary shift shows the day the user actually experiences.
  const localDays = new Set<number>();
  let cursor = new Date();
  for (let i = 0; i < 14 && localDays.size < 7; i += 1) {
    const next = nextRunFromCron(cron, cursor);
    if (!next) break;
    const wd = localWeekdayIndex(next, tz);
    if (wd >= 0) localDays.add(wd);
    cursor = new Date(next.getTime() + 60_000);
  }

  const days = [...localDays].sort((a, b) => a - b);
  if (days.length === 5 && days.join(",") === "1,2,3,4,5") return "Weekdays (Mon–Fri)";
  if (days.length === 1) return `Every ${WEEKDAY_NAMES[days[0]]}`;
  if (days.length > 0) return `Every ${days.map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(", ")}`;
  return null;
}

/** Format an exact date/time in the viewer's timezone, e.g. "Mon, Sep 8, 8:00 AM". */
export function formatNextRunExact(date: Date, tz: string = getUserTimeZone()): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
