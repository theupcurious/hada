import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromFile, isSupportedAttachment } from "@/lib/attachments/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Expected a multipart form upload.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("No file provided.", 400);
  }
  if (file.size === 0) {
    return jsonError("File is empty.", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonError("File is too large (max 10 MB).", 413);
  }
  if (!isSupportedAttachment(file.name, file.type)) {
    return jsonError(
      "Unsupported file type. Upload a PDF, Word (.docx), Excel/CSV, or text file.",
      415,
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractTextFromFile(file.name, buffer, file.type);
    if (!extracted.content.trim()) {
      return jsonError("Couldn't read any text from that file.", 422);
    }
    return Response.json(extracted);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to read the file.",
      422,
    );
  }
}
