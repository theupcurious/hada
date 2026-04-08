import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

interface SharedDocumentRow {
  share_id: string;
  created_at: string;
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
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("document_shares")
    .select(`
      share_id,
      created_at,
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
    },
  });
}
