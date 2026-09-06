/**
 * Turn a stable machine memory key ("work-hours", "travel_preferences") into a
 * readable title for DISPLAY ONLY. The raw key is an identity: it lives in the
 * (user_id, project_id, topic) unique index and is how save_memory resolves an
 * existing row to update. Callers must keep editing and saving the raw value —
 * never persist the humanized form, or the next agent write inserts a duplicate.
 */
export function formatTopicTitle(topic: string): string {
  const cleaned = topic.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return topic;
  return cleaned.replace(/\b\p{L}/gu, (char) => char.toUpperCase());
}
