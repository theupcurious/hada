import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, folder, content, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const documents = (data ?? []).map((doc) => ({
    ...doc,
    preview: String(doc.content ?? "").slice(0, 120).replace(/\s+/g, " ").trim(),
  }));

  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
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
