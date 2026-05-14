// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/queries", () => ({
  checkDailyLimit: vi.fn(),
  incrementUsage: vi.fn(),
  saveAttempt: vi.fn(),
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn(() => "model-stub") }));

import { POST } from "@/app/api/ai/speaking/route";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, incrementUsage, saveAttempt } from "@/lib/supabase/queries";
import { generateText } from "ai";
import { createMockSupabaseClient, authedMock } from "@/__tests__/helpers/mock-supabase";
import { makeAudioBlob } from "@/__tests__/helpers/factories";
import { formDataRequest } from "@/__tests__/helpers/request";
import { SPEAKING_MIN_AUDIO_BYTES } from "@/lib/api-constants";

const VALID_FEEDBACK = {
  overall_band: 6.5,
  fluency_coherence: 6.5,
  lexical_resource: 6.5,
  grammatical_range: 6.5,
  pronunciation: 6.5,
  transcript: "t",
  summary: "s",
  strengths: ["a"],
  improvements: [],
  model_phrases: ["x"],
};

const VALID_TRANSCRIPT =
  "this is a sufficiently long transcript with many words to pass the floor";

function mockWhisper(text: string, ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ text }), { status: ok ? 200 : 500 })
  );
}

function setupOk(opts: { user?: { id: string }; limit?: boolean } = {}) {
  const sb = opts.user ? authedMock(opts.user.id) : createMockSupabaseClient();
  (createClient as Mock).mockResolvedValue(sb);
  (checkDailyLimit as Mock).mockResolvedValue(opts.limit ?? true);
  (generateText as Mock).mockResolvedValue({ text: JSON.stringify(VALID_FEEDBACK) });
  mockWhisper(VALID_TRANSCRIPT);
  return sb;
}

const validBlob = () => makeAudioBlob(SPEAKING_MIN_AUDIO_BYTES * 2);

describe("POST /api/ai/speaking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  describe("input validation", () => {
    it("rejects missing audio", async () => {
      setupOk();
      const res = await POST(formDataRequest({ topic: "t" }));
      expect(res.status).toBe(400);
    });

    it("rejects missing topic", async () => {
      setupOk();
      const res = await POST(formDataRequest({ audio: validBlob() }));
      expect(res.status).toBe(400);
    });

    it("rejects audio below the minimum byte threshold", async () => {
      setupOk();
      const res = await POST(formDataRequest({
        audio: makeAudioBlob(SPEAKING_MIN_AUDIO_BYTES - 1),
        topic: "t",
      }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("no_audio");
    });

    it("returns 500 when OPENAI_API_KEY is missing", async () => {
      setupOk();
      delete process.env.OPENAI_API_KEY;
      const res = await POST(formDataRequest({ audio: validBlob(), topic: "t" }));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("config");
    });
  });

  describe("transcript validation", () => {
    it("rejects empty transcript from Whisper", async () => {
      setupOk();
      mockWhisper("");
      const res = await POST(formDataRequest({ audio: validBlob(), topic: "t" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("no_audio");
    });

    it("rejects transcripts with fewer than the minimum word count", async () => {
      setupOk();
      mockWhisper("only three short words");
      const res = await POST(formDataRequest({ audio: validBlob(), topic: "t" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("too_short");
    });
  });

  describe("AI response handling", () => {
    it("strips markdown fences and returns clamped bands", async () => {
      setupOk();
      (generateText as Mock).mockResolvedValue({
        text: "```json\n" + JSON.stringify({
          ...VALID_FEEDBACK, overall_band: 99, fluency_coherence: -1, pronunciation: 7.3,
        }) + "\n```",
      });
      const body = await (await POST(formDataRequest({ audio: validBlob(), topic: "t" }))).json();
      expect(body.overall_band).toBe(9);
      expect(body.fluency_coherence).toBe(0);
      expect(body.pronunciation).toBe(7.5);
    });

    it("returns 500 on JSON parse failure", async () => {
      setupOk();
      (generateText as Mock).mockResolvedValue({ text: "not-json" });
      const res = await POST(formDataRequest({ audio: validBlob(), topic: "t" }));
      expect(res.status).toBe(500);
    });
  });

  describe("quota & persistence", () => {
    it("increments usage only after a successful AI evaluation", async () => {
      setupOk({ user: { id: "u1" } });
      await POST(formDataRequest({ audio: validBlob(), topic: "t" }));
      expect(generateText).toHaveBeenCalled();
      expect(incrementUsage).toHaveBeenCalledWith(expect.anything(), "u1", "speaking");
      const aiOrder  = (generateText  as Mock).mock.invocationCallOrder[0];
      const incOrder = (incrementUsage as Mock).mock.invocationCallOrder[0];
      expect(aiOrder).toBeLessThan(incOrder);
    });

    it("saves attempt when user + contentId present", async () => {
      setupOk({ user: { id: "u1" } });
      await POST(formDataRequest({ audio: validBlob(), topic: "t", contentId: "c1" }));
      expect(saveAttempt).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          user_id: "u1",
          content_id: "c1",
          content_type: "speaking",
          band_score: 6.5,
        })
      );
    });
  });
});
