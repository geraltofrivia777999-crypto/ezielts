import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/server", () => ({
  NextResponse: {
    redirect: vi.fn((url: string | URL) => ({ url: url.toString(), status: 307 })),
  },
}));

import { GET } from "@/app/api/auth/callback/route";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createMockSupabaseClient } from "@/__tests__/helpers/mock-supabase";
import { getRequest } from "@/__tests__/helpers/request";

const lastRedirectUrl = (): string => (NextResponse.redirect as Mock).mock.calls[0][0];

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("redirects to /dashboard after successful code exchange", async () => {
    const sb = createMockSupabaseClient();
    (createClient as Mock).mockResolvedValue(sb);
    await GET(getRequest("https://app.test/api/auth/callback?code=abc"));
    expect(sb.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(lastRedirectUrl()).toBe("https://app.test/dashboard");
  });

  it("honours a custom ?next= destination", async () => {
    (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
    await GET(getRequest("https://app.test/api/auth/callback?code=abc&next=/settings"));
    expect(lastRedirectUrl()).toBe("https://app.test/settings");
  });

  it("redirects to /login?error=oauth when there is no code", async () => {
    await GET(getRequest("https://app.test/api/auth/callback"));
    expect(lastRedirectUrl()).toBe("https://app.test/login?error=oauth");
  });

  it("redirects to /login?error=oauth when code exchange fails", async () => {
    const sb = createMockSupabaseClient();
    sb.auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad") });
    (createClient as Mock).mockResolvedValue(sb);
    await GET(getRequest("https://app.test/api/auth/callback?code=bad"));
    expect(lastRedirectUrl()).toBe("https://app.test/login?error=oauth");
  });

  describe("origin resolution (proxy / env / request)", () => {
    it("uses x-forwarded-host + x-forwarded-proto when present", async () => {
      (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
      await GET(getRequest("https://internal.local/api/auth/callback?code=abc", {
        "x-forwarded-host": "public.example.com",
        "x-forwarded-proto": "https",
      }));
      expect(lastRedirectUrl()).toBe("https://public.example.com/dashboard");
    });

    it("defaults x-forwarded-proto to https when only host is present", async () => {
      (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
      await GET(getRequest("http://internal.local/api/auth/callback?code=abc", {
        "x-forwarded-host": "public.example.com",
      }));
      expect(lastRedirectUrl()).toBe("https://public.example.com/dashboard");
    });

    it("falls back to NEXT_PUBLIC_APP_URL when no forwarded headers", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://configured.example.com";
      (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
      await GET(getRequest("https://other.local/api/auth/callback?code=abc"));
      expect(lastRedirectUrl()).toBe("https://configured.example.com/dashboard");
    });

    it("falls back to request origin when no header and no env", async () => {
      (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
      await GET(getRequest("https://raw.example.com/api/auth/callback?code=abc"));
      expect(lastRedirectUrl()).toBe("https://raw.example.com/dashboard");
    });
  });
});
