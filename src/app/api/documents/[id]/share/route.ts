import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function buildShareUrl(request: NextRequest, shareId: string) {
  return new URL(`/share/docs/${shareId}`, request.url).toString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("document_shares")
    .select("share_id, created_at")
    .eq("document_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ share: null });

  return NextResponse.json({
    share: {
      shareId: data.share_id,
      shareUrl: buildShareUrl(request, data.share_id),
      createdAt: data.created_at,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: existingShare, error: existingError } = await supabase
    .from("document_shares")
    .select("share_id, created_at")
    .eq("document_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingShare) {
    return NextResponse.json({
      share: {
        shareId: existingShare.share_id,
        shareUrl: buildShareUrl(request, existingShare.share_id),
        createdAt: existingShare.created_at,
      },
    });
  }

  const { data, error } = await supabase
    .from("document_shares")
    .insert({ document_id: id, user_id: user.id })
    .select("share_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      share: {
        shareId: data.share_id,
        shareUrl: buildShareUrl(request, data.share_id),
        createdAt: data.created_at,
      },
    },
    { status: 201 },
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("document_shares")
    .delete()
    .eq("document_id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
