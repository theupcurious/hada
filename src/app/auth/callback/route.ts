import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/chat";

  if (error) {
    const params = new URLSearchParams();
    params.set("error", error);
    if (errorCode) {
      params.set("error_code", errorCode);
    }
    if (errorDescription) {
      params.set("error_description", errorDescription);
    }
    return NextResponse.redirect(`${origin}/auth/error?${params.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // PKCE exchange failed — this happens when the verification link is opened in a
    // different browser or device than where signup occurred (the code_verifier cookie
    // is missing). Supabase already confirmed the email server-side, so redirect to
    // login with a success message instead of an error page.
    return NextResponse.redirect(`${origin}/auth/login?verified=1`);
  }

  if (tokenHash && type) {
    const emailOtpTypes = new Set([
      "signup",
      "invite",
      "magiclink",
      "recovery",
      "email_change",
    ]);
    if (!emailOtpTypes.has(type)) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=unsupported_otp_type&error_code=otp_type&error_description=Unsupported+OTP+type`
      );
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
