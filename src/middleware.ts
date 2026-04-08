import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/chat/:path*",
    "/dashboard/:path*",
    "/docs/:path*",
    "/settings/:path*",
  ],
};
