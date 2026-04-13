import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/documents/by-title?title=Page+Title&folder=wiki
 * Resolves a [[wikilink]] title to a document ID for click-to-navigate.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const title = request.nextUrl.searchParams.get("title")?.trim();
  const folder = request.nextUrl.searchParams.get("folder")?.trim() ?? null;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  let query = supabase
    .from("documents")
    .select("id, title, folder")
    .eq("user_id", user.id)
    .ilike("title", title)
    .limit(1);

  if (folder) {
    query = query.eq("folder", folder);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ id: data.id, title: data.title, folder: data.folder });
}
