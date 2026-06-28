/**
 * Google Drive API utilities — read-only access to files and Google Docs.
 * Documentation: https://developers.google.com/drive/api/v3/reference
 */

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: string[];
}

const EXPORTABLE_AS_TEXT: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

/** Search Drive with a free-text term or a raw Drive query. */
export async function searchFiles(
  accessToken: string,
  term: string,
  maxResults = 10,
): Promise<DriveFile[]> {
  const url = new URL(`${DRIVE_API_BASE}/files`);
  // If the caller passed a raw Drive query (contains an operator), use it as-is;
  // otherwise wrap a plain term in a fullText search.
  const q = /[:=<>]/.test(term) ? term : `name contains '${term.replace(/'/g, "\\'")}' or fullText contains '${term.replace(/'/g, "\\'")}'`;
  url.searchParams.set("q", `${q} and trashed = false`);
  url.searchParams.set("pageSize", String(Math.min(Math.max(maxResults, 1), 25)));
  url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,owners(emailAddress))");
  url.searchParams.set("orderBy", "modifiedTime desc");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to search Drive: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    files?: Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime?: string;
      webViewLink?: string;
      owners?: Array<{ emailAddress?: string }>;
    }>;
  };
  return (data.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
    owners: file.owners?.map((o) => o.emailAddress ?? "").filter(Boolean),
  }));
}

/** Read a file's text content. Google-native docs are exported to text/CSV. */
export async function readFileContent(
  accessToken: string,
  fileId: string,
  maxChars = 12_000,
): Promise<{ name: string; mimeType: string; content: string; truncated: boolean }> {
  const metaResponse = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!metaResponse.ok) {
    throw new Error(`Failed to read Drive file: ${await metaResponse.text()}`);
  }
  const meta = (await metaResponse.json()) as { name: string; mimeType: string };

  const exportType = EXPORTABLE_AS_TEXT[meta.mimeType];
  const contentUrl = exportType
    ? `${DRIVE_API_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportType)}`
    : `${DRIVE_API_BASE}/files/${fileId}?alt=media`;

  const contentResponse = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!contentResponse.ok) {
    // Binary/unsupported types (PDF, images) can't be read as text here.
    if (!exportType && !meta.mimeType.startsWith("text/")) {
      throw new Error(`File type "${meta.mimeType}" can't be read as text.`);
    }
    throw new Error(`Failed to read Drive file: ${await contentResponse.text()}`);
  }

  const raw = await contentResponse.text();
  const truncated = raw.length > maxChars;
  return {
    name: meta.name,
    mimeType: meta.mimeType,
    content: truncated ? raw.slice(0, maxChars) : raw,
    truncated,
  };
}
