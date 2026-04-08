import { notFound } from "next/navigation";
import { SharedDocView } from "@/components/docs/shared-doc-view";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SharedDocumentRow {
  share_id: string;
  documents: {
    title: string;
    content: string;
    updated_at: string;
  } | null;
}

export default async function SharedDocumentPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("document_shares")
    .select(`
      share_id,
      documents!inner (
        title,
        content,
        updated_at
      )
    `)
    .eq("share_id", shareId)
    .single();

  if (error || !data) notFound();

  const shared = data as unknown as SharedDocumentRow;
  if (!shared.documents) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const shareUrl = appUrl
    ? new URL(`/share/docs/${shareId}`, appUrl).toString()
    : `/share/docs/${shareId}`;

  return (
    <SharedDocView
      title={shared.documents.title}
      content={shared.documents.content}
      updatedAt={shared.documents.updated_at}
      shareUrl={shareUrl}
    />
  );
}
