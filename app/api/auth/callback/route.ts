import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/signup?premium=1";

  // Resolve the public origin (Render/Vercel/proxies set x-forwarded-*).
  // Falls back to NEXT_PUBLIC_APP_URL, then to the raw request origin.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? url.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Successful exchange — redirect to premium popup (or wherever `next` says)
      const response = NextResponse.redirect(`${publicOrigin}${next}`);
      // Set cookie so middleware guarantees the popup even if this redirect is lost
      response.cookies.set("ez_show_premium", "1", {
        path: "/",
        maxAge: 86400,
        sameSite: "lax",
      });
      return response;
    }
  }

  // Code exchange failed — send to login. The ez_show_premium cookie
  // (set during signup) will ensure middleware redirects to premium popup
  // once the user logs in successfully.
  return NextResponse.redirect(`${publicOrigin}/login?error=oauth`);
}
