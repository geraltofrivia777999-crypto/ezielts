import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Server-side check: redirects to /login if not authed, /dashboard if not admin. */
export async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: profile } = await (sb as any)
    .from("profiles")
    .select("is_admin, name, email")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return { user, profile: profile as { is_admin: boolean; name: string | null; email: string | null } };
}
