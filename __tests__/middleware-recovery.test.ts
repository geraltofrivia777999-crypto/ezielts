import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ status: 200 })),
    redirect: vi.fn(),
  },
}));

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { middleware } from "@/middleware";

describe("auth middleware recovery callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "publishable-key";
  });

  it("does not refresh stale auth cookies before forwarding a root recovery code", async () => {
    const request = {
      nextUrl: {
        pathname: "/",
        searchParams: new URLSearchParams("code=recovery-code"),
      },
    } as unknown as NextRequest;

    await middleware(request);

    expect(NextResponse.next).toHaveBeenCalledWith({ request });
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
