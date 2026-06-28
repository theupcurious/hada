import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

/** Cap extracted text so a single file can't blow the context budget. */
const MAX_CHARS = 20_000;

export const SUPPORTED_EXTENSIONS = [
  "pdf",
  "docx",
  "xlsx",
  "xls",
  "csv",
  "tsv",
  "txt",
  "md",
  "markdown",
  "json",
  "log",
] as const;

export interface ExtractedAttachment {
  title: string;
  content: string;
  truncated: boolean;
  kind: "pdf" | "spreadsheet" | "document" | "text";
}

function fileExtension(filename: string): string {
  return (filename.split(".").pop() || "").toLowerCase();
}

export function isSupportedAttachment(filename: string, mimeType: string): boolean {
  const ext = fileExtension(filename);
  return (
    (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext) ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("wordprocessingml")
  );
}

/**
 * Extract plain text from an uploaded document (PDF, Word, Excel/CSV, or text).
 * Returns text suitable for injecting into the chat as attached context.
 */
export async function extractTextFromFile(
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractedAttachment> {
  const ext = fileExtension(filename);
  let raw = "";
  let kind: ExtractedAttachment["kind"];

  if (ext === "pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      raw = result.text || "";
    } finally {
      await parser.destroy();
    }
    kind = "pdf";
  } else if (
    ["xlsx", "xls", "csv", "tsv"].includes(ext) ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  ) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      if (csv.trim()) {
        parts.push(workbook.SheetNames.length > 1 ? `# Sheet: ${sheetName}\n${csv}` : csv);
      }
    }
    raw = parts.join("\n\n");
    kind = "spreadsheet";
  } else if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value || "";
    kind = "document";
  } else if (
    ["txt", "md", "markdown", "json", "log"].includes(ext) ||
    mimeType.startsWith("text/")
  ) {
    raw = buffer.toString("utf-8");
    kind = "text";
  } else {
    throw new Error(
      `Unsupported file type "${ext || mimeType}". Supported: PDF, Word (.docx), Excel/CSV, and text files.`,
    );
  }

  const cleaned = raw.replace(new RegExp("\\u0000", "g"), "").replace(/\n{3,}/g, "\n\n").trim();
  const truncated = cleaned.length > MAX_CHARS;
  return {
    title: filename,
    content: truncated ? `${cleaned.slice(0, MAX_CHARS)}\n\n[content truncated]` : cleaned,
    truncated,
    kind,
  };
}
