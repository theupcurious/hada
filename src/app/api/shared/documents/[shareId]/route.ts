import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SharedDocumentRow {
  share_id: string;
  created_at: string;
  expires_at: string | null;
  documents: {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    created_at: string;
  } | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  if (!UUID_RE.test(shareId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("document_shares")
    .select(`
      share_id,
      created_at,
      expires_at,
      documents!inner (
        id,
        title,
        content,
        created_at,
        updated_at
      )
    `)
    .eq("share_id", shareId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const shared = data as unknown as SharedDocumentRow;
  if (!shared.documents) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (shared.expires_at && new Date(shared.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This share link has expired" }, { status: 410 });
  }

  return NextResponse.json({
    document: {
      id: shared.documents.id,
      title: shared.documents.title,
      content: shared.documents.content,
      createdAt: shared.documents.created_at,
      updatedAt: shared.documents.updated_at,
    },
    share: {
      shareId: shared.share_id,
      createdAt: shared.created_at,
      expiresAt: shared.expires_at,
    },
  }, {
    headers: {
      // Public-by-link content: keep it out of shared caches and search indexes.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
