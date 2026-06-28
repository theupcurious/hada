/**
 * Gmail API utilities — thin wrapper around the Gmail REST API.
 * Documentation: https://developers.google.com/gmail/api/reference/rest
 */

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
}

export interface GmailMessageFull extends GmailMessageSummary {
  body: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPayloadPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
}

interface GmailMessageResource {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: GmailPayloadPart;
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  const match = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match?.value ?? "";
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

// Walk the MIME tree and extract the best-effort plain-text body.
function extractBody(payload: GmailPayloadPart | undefined): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts?.length) {
    // Prefer text/plain, then fall back to text/html (stripped), then recurse.
    const plain = payload.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);

    const html = payload.parts.find((p) => p.mimeType === "text/html" && p.body?.data);
    if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data));

    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(raw) : raw;
  }

  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function toSummary(resource: GmailMessageResource): GmailMessageSummary {
  const headers = resource.payload?.headers;
  return {
    id: resource.id,
    threadId: resource.threadId,
    from: header(headers, "From"),
    to: header(headers, "To"),
    subject: header(headers, "Subject"),
    date: header(headers, "Date"),
    snippet: resource.snippet ?? "",
  };
}

async function gmailFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Search messages with a Gmail query string (e.g. "is:unread", "from:alice").
 * Returns lightweight summaries (one metadata fetch per message).
 */
export async function searchMessages(
  accessToken: string,
  query: string,
  maxResults = 10,
): Promise<GmailMessageSummary[]> {
  const url = new URL(`${GMAIL_API_BASE}/messages`);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(Math.min(Math.max(maxResults, 1), 25)));

  const listResponse = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listResponse.ok) {
    throw new Error(`Failed to search messages: ${await listResponse.text()}`);
  }
  const list = (await listResponse.json()) as { messages?: Array<{ id: string }> };
  const ids = (list.messages ?? []).map((m) => m.id);

  const summaries = await Promise.all(
    ids.map(async (id) => {
      const response = await gmailFetch(
        accessToken,
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      );
      if (!response.ok) return null;
      return toSummary((await response.json()) as GmailMessageResource);
    }),
  );

  return summaries.filter((s): s is GmailMessageSummary => s !== null);
}

/** Fetch a single message with its decoded plain-text body. */
export async function getMessage(accessToken: string, id: string): Promise<GmailMessageFull> {
  const response = await gmailFetch(accessToken, `/messages/${id}?format=full`);
  if (!response.ok) {
    throw new Error(`Failed to read message: ${await response.text()}`);
  }
  const resource = (await response.json()) as GmailMessageResource;
  return { ...toSummary(resource), body: extractBody(resource.payload) };
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

function buildRawMessage(email: OutgoingEmail): string {
  const lines = [
    `To: ${email.to}`,
    email.cc ? `Cc: ${email.cc}` : null,
    email.bcc ? `Bcc: ${email.bcc}` : null,
    `Subject: ${email.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    email.body,
  ].filter((line): line is string => line !== null);

  return Buffer.from(lines.join("\r\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Send an email immediately. */
export async function sendMessage(accessToken: string, email: OutgoingEmail): Promise<{ id: string }> {
  const response = await gmailFetch(accessToken, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: buildRawMessage(email) }),
  });
  if (!response.ok) {
    throw new Error(`Failed to send email: ${await response.text()}`);
  }
  return (await response.json()) as { id: string };
}

/** Create a draft (does not send). */
export async function createDraft(accessToken: string, email: OutgoingEmail): Promise<{ id: string }> {
  const response = await gmailFetch(accessToken, "/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: buildRawMessage(email) } }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create draft: ${await response.text()}`);
  }
  return (await response.json()) as { id: string };
}
