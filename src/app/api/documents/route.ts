import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, folder, content, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const docIds = (data ?? []).map((doc) => doc.id);
  let sharedIds = new Set<string>();

  if (docIds.length > 0) {
    const { data: shares, error: shareError } = await supabase
      .from("document_shares")
      .select("document_id")
      .eq("user_id", user.id)
      .in("document_id", docIds);

    if (shareError) return NextResponse.json({ error: shareError.message }, { status: 500 });
    sharedIds = new Set((shares ?? []).map((share) => share.document_id));
  }

  const documents = (data ?? []).map((doc) => ({
    ...doc,
    preview: String(doc.content ?? "").slice(0, 120).replace(/\s+/g, " ").trim(),
    shared: sharedIds.has(doc.id),
  }));

  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const title = String(body.title ?? "Untitled").trim() || "Untitled";
  const content = String(body.content ?? "");
  const folder = body.folder ? String(body.folder).trim() || null : null;

  const { data, error } = await supabase
    .from("documents")
    .insert({ user_id: user.id, title, content, folder })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folder = request.nextUrl.searchParams.get("folder")?.trim();
  if (!folder) {
    return NextResponse.json({ error: "Folder is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("user_id", user.id)
    .eq("folder", folder)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    deletedCount: data?.length ?? 0,
  });
}
