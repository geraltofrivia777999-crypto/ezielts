import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/queries", () => ({
  checkDailyLimit: vi.fn(),
  incrementUsage: vi.fn(),
  saveAttempt: vi.fn(),
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn(() => "model-stub") }));

import { POST } from "@/app/api/ai/writing/route";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveAttempt } from "@/lib/supabase/queries";
import { generateText } from "ai";
import { createMockSupabaseClient, authedMock } from "@/__tests__/helpers/mock-supabase";
import { makeEssay } from "@/__tests__/helpers/factories";
import { jsonRequest } from "@/__tests__/helpers/request";
import { WRITING_ABSOLUTE_MIN_WORDS } from "@/lib/api-constants";

// A realistic AI-shaped response. Tests only assert the fields they care about.
const VALID_AI_RESPONSE = {
  overall_band: 6.5,
  criteria: {
    task_achievement:   { band: 6,   comment: "..." },
    coherence_cohesion: { band: 7,   comment: "..." },
    lexical_resource:   { band: 6.5, comment: "..." },
    grammatical_range:  { band: 6.5, comment: "..." },
  },
  summary: "ok",
  strengths: ["a", "b", "c"],
  improvements: [],
  corrected_intro: "fixed",
};

const validEssay = makeEssay(80); // safely above the 50-word floor

function setupOk(opts: { user?: { id: string } | null; limit?: boolean } = {}) {
  const sb = opts.user
    ? authedMock(opts.user.id)
    : createMockSupabaseClient();
  (createClient as Mock).mockResolvedValue(sb);
  (checkDailyLimit as Mock).mockResolvedValue(opts.limit ?? true);
  (generateText as Mock).mockResolvedValue({ text: JSON.stringify(VALID_AI_RESPONSE) });
  return sb;
}

describe("POST /api/ai/writing", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("input validation", () => {
    it("rejects missing essay", async () => {
      setupOk();
      const res = await POST(jsonRequest({ prompt: "p" }));
      expect(res.status).toBe(400);
    });

    it("rejects missing prompt", async () => {
      setupOk();
      const res = await POST(jsonRequest({ essay: validEssay }));
      expect(res.status).toBe(400);
    });

    it("rejects non-string essay", async () => {
      setupOk();
      const res = await POST(jsonRequest({ essay: 42 as unknown, prompt: "p" }));
      expect(res.status).toBe(400);
    });

    it("rejects essays under the absolute minimum word count without touching AI/quota", async () => {
      setupOk({ user: { id: "u1" } });
      const res = await POST(jsonRequest({ essay: makeEssay(WRITING_ABSOLUTE_MIN_WORDS - 1), prompt: "p" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("too_short");
      expect(checkDailyLimit).not.toHaveBeenCalled();
      expect(generateText).not.toHaveBeenCalled();
      expect(incrementUsage).not.toHaveBeenCalled();
    });
  });

  describe("quota & ordering", () => {
    it("returns 429 when daily limit is exhausted", async () => {
      setupOk({ user: { id: "u1" }, limit: false });
      const res = await POST(jsonRequest({ essay: validEssay, prompt: "p" }));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("limit_reached");
    });

    it("increments usage ONLY after a successful AI evaluation", async () => {
      setupOk({ user: { id: "u1" } });
      await POST(jsonRequest({ essay: validEssay, prompt: "p", taskType: "task1" }));
      // Both called once, and generateText must complete first
      expect(generateText).toHaveBeenCalledTimes(1);
      expect(incrementUsage).toHaveBeenCalledTimes(1);
      const aiOrder  = (generateText  as Mock).mock.invocationCallOrder[0];
      const incOrder = (incrementUsage as Mock).mock.invocationCallOrder[0];
      expect(aiOrder).toBeLessThan(incOrder);
    });

    it("does NOT increment usage when the AI response fails to parse", async () => {
      setupOk({ user: { id: "u1" } });
      (generateText as Mock).mockResolvedValue({ text: "garbage" });
      const res = await POST(jsonRequest({ essay: validEssay, prompt: "p" }));
      expect(res.status).toBe(500);
      expect(incrementUsage).not.toHaveBeenCalled();
    });
  });

  describe("AI response handling", () => {
    it("strips markdown code fences before parsing", async () => {
      setupOk();
      (generateText as Mock).mockResolvedValue({
        text: "```json\n" + JSON.stringify(VALID_AI_RESPONSE) + "\n```",
      });
      const res = await POST(jsonRequest({ essay: validEssay, prompt: "p" }));
      expect(res.status).toBe(200);
      expect((await res.json()).overall_band).toBe(6.5);
    });

    it("clamps all band scores to the IELTS scale [0,9] in 0.5 steps", async () => {
      setupOk();
      (generateText as Mock).mockResolvedValue({
        text: JSON.stringify({
          ...VALID_AI_RESPONSE,
          overall_band: 99,
          criteria: {
            task_achievement:   { band: -5,  comment: "..." },
            coherence_cohesion: { band: 7.3, comment: "..." },
            lexical_resource:   { band: 6.5, comment: "..." },
            grammatical_range:  { band: 6.5, comment: "..." },
          },
        }),
      });
      const body = await (await POST(jsonRequest({ essay: validEssay, prompt: "p" }))).json();
      expect(body.overall_band).toBe(9);
      expect(body.criteria.task_achievement.band).toBe(0);
      expect(body.criteria.coherence_cohesion.band).toBe(7.5);
    });
  });

  describe("persistence", () => {
    it("saves attempt with the clamped band when user + contentId present", async () => {
      const sb = setupOk({ user: { id: "u1" } });
      await POST(jsonRequest({ essay: validEssay, prompt: "p", contentId: "c1" }));
      expect(saveAttempt).toHaveBeenCalledTimes(1);
      expect(saveAttempt).toHaveBeenCalledWith(
        sb,
        expect.objectContaining({
          user_id: "u1",
          content_id: "c1",
          content_type: "writing",
          band_score: 6.5,
        })
      );
    });

    it.each([
      ["no contentId",  { contentId: undefined, user: { id: "u1" } }],
      ["no user",       { contentId: "c1",      user: null }],
    ])("does not save attempt — %s", async (_label, { contentId, user }) => {
      setupOk({ user });
      await POST(jsonRequest({ essay: validEssay, prompt: "p", contentId }));
      expect(saveAttempt).not.toHaveBeenCalled();
    });
  });
});
