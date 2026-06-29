/**
 * Human-readable labels for agent tools.
 *
 * Non-technical users shouldn't see raw tool names like `gmail_search`. This
 * registry maps each tool to a plain-language present-tense label (for the live
 * "what the assistant is doing" pills) and a past-tense label (for the Activity
 * log of what it already did). Keep the verbs concrete and reassuring.
 */

export type ToolCategory =
  | "web"
  | "email"
  | "drive"
  | "calendar"
  | "documents"
  | "memory"
  | "tasks"
  | "agent"
  | "other";

export interface ToolLabel {
  /** Present continuous, shown while running: "Searching your email". */
  present: string;
  /** Past tense, shown after completion: "Searched your email". */
  past: string;
  category: ToolCategory;
}

const TOOL_LABELS: Record<string, ToolLabel> = {
  web_search: { present: "Searching the web", past: "Searched the web", category: "web" },
  web_fetch: { present: "Reading a web page", past: "Read a web page", category: "web" },

  gmail_search: { present: "Searching your email", past: "Searched your email", category: "email" },
  gmail_read: { present: "Reading an email", past: "Read an email", category: "email" },
  gmail_draft: { present: "Drafting an email", past: "Drafted an email", category: "email" },
  gmail_send: { present: "Sending an email", past: "Sent an email", category: "email" },

  drive_search: { present: "Searching your Drive", past: "Searched your Drive", category: "drive" },
  drive_read: { present: "Reading a Drive file", past: "Read a Drive file", category: "drive" },

  list_calendar_events: { present: "Checking your calendar", past: "Checked your calendar", category: "calendar" },
  create_calendar_event: { present: "Adding a calendar event", past: "Added a calendar event", category: "calendar" },
  update_calendar_event: { present: "Updating a calendar event", past: "Updated a calendar event", category: "calendar" },
  delete_calendar_event: { present: "Removing a calendar event", past: "Removed a calendar event", category: "calendar" },

  create_document: { present: "Writing a document", past: "Wrote a document", category: "documents" },
  update_document: { present: "Updating a document", past: "Updated a document", category: "documents" },
  read_document: { present: "Reading a document", past: "Read a document", category: "documents" },
  delete_document: { present: "Deleting a document", past: "Deleted a document", category: "documents" },
  list_documents: { present: "Looking through your documents", past: "Looked through your documents", category: "documents" },
  search_documents: { present: "Searching your documents", past: "Searched your documents", category: "documents" },

  save_memory: { present: "Saving to memory", past: "Saved to memory", category: "memory" },
  recall_memory: { present: "Recalling from memory", past: "Recalled from memory", category: "memory" },

  schedule_task: { present: "Scheduling a task", past: "Scheduled a task", category: "tasks" },
  plan_task: { present: "Planning the steps", past: "Planned the steps", category: "tasks" },

  delegate_task: { present: "Research agent working", past: "Used a research agent", category: "agent" },
  mcp_call: { present: "Using a connected tool", past: "Used a connected tool", category: "other" },
  render_card: { present: "Preparing a summary", past: "Prepared a summary", category: "other" },
};

/**
 * Friendly label for a tool. Falls back to a humanized version of the raw name
 * so a newly-added tool still reads reasonably before it's added here.
 */
export function getToolLabel(name: string): ToolLabel {
  const known = TOOL_LABELS[name];
  if (known) {
    return known;
  }

  const humanized = humanizeToolName(name);
  return { present: humanized, past: humanized, category: "other" };
}

function humanizeToolName(name: string): string {
  const words = name.replace(/[_-]+/g, " ").trim();
  if (!words) {
    return "Working";
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}
