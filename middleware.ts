import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED = ["/dashboard", "/tests", "/progress", "/pricing", "/checkout", "/admin", "/settings", "/tutor", "/plan"];
// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Supabase may send password-recovery codes to the Site URL. Do not touch
  // stale auth cookies before the landing page forwards the code to callback.
  if (pathname === "/" && searchParams.has("code")) {
    return NextResponse.next({ request });
  }

  // Skip auth middleware if Supabase is not configured yet
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );


  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  // Exception: /signup?premium=1 is the post-signup upsell screen — allow it even if logged in
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));
  const isPostSignupPremium = pathname.startsWith("/signup") && request.nextUrl.searchParams.get("premium") === "1";
  if (isAuthRoute && user && !isPostSignupPremium) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Guarantee premium popup for new signups ──
  // If user is authenticated and heading to a protected route but hasn't seen
  // the premium popup yet, redirect them there first. This catches ALL entry
  // paths: direct login, email callback, OAuth, different browser, etc.
  if (user && isProtected) {
    const seenPremium = request.cookies.get("ez_seen_premium")?.value;
    const showPremium = request.cookies.get("ez_show_premium")?.value;

    if (!seenPremium) {
      // Cookie-based: signup happened in this browser
      if (showPremium === "1") {
        const url = request.nextUrl.clone();
        url.pathname = "/signup";
        url.searchParams.set("premium", "1");
        return NextResponse.redirect(url);
      }

      // Time-based fallback: account created < 1 hour ago (covers different browser)
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (createdAt > oneHourAgo) {
        const url = request.nextUrl.clone();
        url.pathname = "/signup";
        url.searchParams.set("premium", "1");
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
