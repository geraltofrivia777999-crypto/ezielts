import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/queries", () => ({
  checkDailyLimit: vi.fn().mockResolvedValue(true),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn(() => "model-stub") }));

import { POST } from "@/app/api/ai/study-plan/route";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit } from "@/lib/supabase/queries";
import { generateText } from "ai";
import { createMockSupabaseClient } from "@/__tests__/helpers/mock-supabase";

const VALID_PLAN = {
  focus_skills: ["writing", "speaking"],
  overall_strategy: "стратегия",
  days: [],
};

function sbWithProfile(profile: any) {
  const sb = createMockSupabaseClient();
  sb.from = vi.fn(() => ({
    select: () => ({
      eq: () => ({ single: () => Promise.resolve({ data: profile }) }),
    }),
  })) as any;
  return sb;
}

describe("POST /api/ai/study-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkDailyLimit as Mock).mockResolvedValue(true);
  });

  it("returns 429 when daily study-plan limit exceeded", async () => {
    const sb = sbWithProfile({ target_band: 7 });
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    (checkDailyLimit as Mock).mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("limit_reached");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    (createClient as Mock).mockResolvedValue(createMockSupabaseClient());
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 404 when profile not found", async () => {
    const sb = sbWithProfile(null);
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("returns parsed JSON plan on success", async () => {
    const sb = sbWithProfile({
      target_band: 7,
      band_reading: 6, band_listening: 6, band_writing: 5.5, band_speaking: 6,
      exam_date: null, exam_type: "academic",
    });
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    (generateText as Mock).mockResolvedValue({ text: JSON.stringify(VALID_PLAN) });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.focus_skills).toEqual(["writing", "speaking"]);
  });

  it("strips markdown fences from AI response", async () => {
    const sb = sbWithProfile({
      target_band: 7,
      band_reading: null, band_listening: null, band_writing: null, band_speaking: null,
      exam_date: null, exam_type: null,
    });
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    (generateText as Mock).mockResolvedValue({
      text: "```json\n" + JSON.stringify(VALID_PLAN) + "\n```",
    });
    const res = await POST();
    expect(res.status).toBe(200);
  });

  it("returns 500 on JSON parse failure", async () => {
    const sb = sbWithProfile({
      target_band: 7,
      band_reading: null, band_listening: null, band_writing: null, band_speaking: null,
      exam_date: null, exam_type: null,
    });
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    (generateText as Mock).mockResolvedValue({ text: "not-json" });
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("includes exam_date days-left calculation in prompt when set", async () => {
    const future = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const sb = sbWithProfile({
      target_band: 7,
      band_reading: 6, band_listening: 6, band_writing: 5, band_speaking: 6,
      exam_date: future, exam_type: "academic",
    });
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    (generateText as Mock).mockResolvedValue({ text: JSON.stringify(VALID_PLAN) });
    await POST();
    const promptArg = (generateText as Mock).mock.calls[0][0];
    const promptText = promptArg.messages[0].content;
    expect(promptText).toMatch(/Days until exam: \d+/);
    expect(promptText).not.toMatch(/Days until exam: not set/);
  });

  it("uses 'not set' when exam_date is null", async () => {
    const sb = sbWithProfile({
      target_band: 7,
      band_reading: null, band_listening: null, band_writing: null, band_speaking: null,
      exam_date: null, exam_type: null,
    });
    sb.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    (createClient as Mock).mockResolvedValue(sb);
    (generateText as Mock).mockResolvedValue({ text: JSON.stringify(VALID_PLAN) });
    await POST();
    const promptText = (generateText as Mock).mock.calls[0][0].messages[0].content;
    expect(promptText).toMatch(/Days until exam: not set/);
  });
});
