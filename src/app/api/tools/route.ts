import { NextResponse } from "next/server";
import { registry } from "@/lib/chat/tools/tool-registry";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { user } = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch connected integrations to optionally filter or annotate tools
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider")
    .eq("user_id", user.id);

  const connectedIntegrations = integrations?.map((i) => i.provider) || [];

  // Get grouped manifests from the registry
  const manifests = registry.getManifests();

  // Annotate with connection status if it requires an integration
  const toolsWithStatus = manifests.map((manifest) => ({
    ...manifest,
    isConnected: manifest.requiresIntegration
      ? connectedIntegrations.includes(manifest.requiresIntegration)
      : true,
  }));

  // Group by category
  const categories: Record<string, typeof toolsWithStatus> = {};
  for (const tool of toolsWithStatus) {
    const cat = tool.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(tool);
  }

  return NextResponse.json({
    success: true,
    total: toolsWithStatus.length,
    tools: toolsWithStatus,
    categories,
    connectedIntegrations,
  });
}
