import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/queries", () => ({
  checkDailyLimit: vi.fn().mockResolvedValue(true),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
  saveTutorMessage: vi.fn().mockResolvedValue({ data: null, error: null }),
}));
vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toTextStreamResponse: () => new Response("stream-body", { status: 200 }),
  })),
}));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn(() => "model-stub") }));

import { POST, buildStudentContext } from "@/app/api/ai/tutor/route";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveTutorMessage } from "@/lib/supabase/queries";
import { createMockSupabaseClient } from "@/__tests__/helpers/mock-supabase";

function mkReq(body: any): Request {
  return new Request("https://example.com/api/ai/tutor", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/ai/tutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkDailyLimit as Mock).mockResolvedValue(true);
  });

  it("returns 400 for invalid messages", async () => {
    (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
    const res = await POST(mkReq({ messages: "not-array" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
    const res = await POST(mkReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when limit exceeded", async () => {
    const sb = createMockSupabaseClient();
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    (checkDailyLimit as Mock).mockResolvedValue(false);
    const res = await POST(mkReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(429);
  });

  it("saves user message and increments usage", async () => {
    const sb = createMockSupabaseClient();
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    const res = await POST(mkReq({ messages: [{ role: "user", content: "hi there" }] }));
    expect(res.status).toBe(200);
    expect(saveTutorMessage).toHaveBeenCalledWith(
      sb,
      expect.objectContaining({ user_id: "u1", role: "user", content: "hi there" })
    );
    expect(incrementUsage).toHaveBeenCalledWith(sb, "u1", "ai_tutor");
  });
});

describe("buildStudentContext", () => {
  function sbWith(summary: any, attempts: any[]) {
    const client: any = {
      from: vi.fn((table: string) => {
        if (table === "v_user_summary") {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: summary }) }),
            }),
          };
        }
        if (table === "user_test_attempts") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: attempts }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    return client;
  }

  it("returns 'New user' message when no data", async () => {
    const sb = sbWith(null, []);
    const ctx = await buildStudentContext(sb, "u1");
    expect(ctx).toMatch(/New user/);
  });

  it("identifies weakest skill from band data", async () => {
    const summary = {
      name: "Alex", target_band: 7, exam_date: null, exam_type: "academic",
      band_reading: 7, band_listening: 6.5, band_writing: 5.5, band_speaking: 6,
      streak: 3, plan: "free",
    };
    const ctx = await buildStudentContext(sbWith(summary, []), "u1");
    expect(ctx).toMatch(/Weakest skill: Writing \(5\.5\)/);
  });

  it("computes days left when exam_date set", async () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const summary = {
      name: "A", target_band: 7, exam_date: future, exam_type: "academic",
      band_reading: null, band_listening: null, band_writing: null, band_speaking: null,
      streak: 0, plan: "free",
    };
    const ctx = await buildStudentContext(sbWith(summary, []), "u1");
    expect(ctx).toMatch(/days left/);
  });

  it("handles null fields gracefully", async () => {
    const summary = {
      name: null, target_band: null, exam_date: null, exam_type: null,
      band_reading: null, band_listening: null, band_writing: null, band_speaking: null,
      streak: null, plan: null,
    };
    const ctx = await buildStudentContext(sbWith(summary, []), "u1");
    expect(ctx).toMatch(/Студент/);
    expect(ctx).toMatch(/не указано/);
  });
});
