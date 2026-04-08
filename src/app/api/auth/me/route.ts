import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    isAdmin: isAdminEmail(user.email),
  });
}
