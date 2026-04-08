import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const { data, error } = await supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load memories" },
        { status: 500 },
      );
    }

    const memories = (data || []).filter((memory) => {
      if (!query) {
        return true;
      }

      const topic = String(memory.topic || "").toLowerCase();
      const content = String(memory.content || "").toLowerCase();
      return topic.includes(query) || content.includes(query);
    });

    return NextResponse.json({
      memories,
      total: memories.length,
    });
  } catch (error) {
    console.error("Dashboard memories API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";

    if (!topic || !content) {
      return NextResponse.json(
        { error: "topic and content are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("user_memories")
      .insert({
        user_id: user.id,
        topic,
        content,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create memory" },
        { status: 500 },
      );
    }

    return NextResponse.json({ memory: data }, { status: 201 });
  } catch (error) {
    console.error("Dashboard memories create API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
