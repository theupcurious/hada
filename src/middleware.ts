import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/chat/:path*",
    "/workflows/:path*",
    "/projects/:path*",
    "/activity/:path*",
    "/dashboard/:path*",
    "/docs/:path*",
    "/settings/:path*",
  ],
};
