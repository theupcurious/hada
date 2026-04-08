import type { SupabaseClient } from "@supabase/supabase-js";

type AuthClaims = Record<string, unknown>;

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  claims: AuthClaims;
};

export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as AuthClaims | null;
  const id = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email : null;

  return {
    user: id
      ? {
          id,
          email,
          claims: claims ?? {},
        }
      : null,
    error,
  };
}
