import { describe, it, expect } from "vitest";
import { mapDbToListeningTest, matchesText } from "@/lib/test-mapping/listening";
import { buildListeningTest, LISTENING_NO_AUDIO } from "@/__tests__/fixtures/listening";

describe("mapDbToListeningTest", () => {
  it("converts MCQ groups into mcq-kind questions with options", () => {
    const t = mapDbToListeningTest(buildListeningTest());
    const mcq = t.sections[0].questions[0];
    expect(mcq.kind).toBe("mcq");
    expect(mcq.options).toEqual(["8pm", "9pm", "6pm"]);
    expect(mcq.answer).toBe(2); // "C"
  });

  it("converts completion / no-options groups into text-kind questions (regression)", () => {
    // Previous bug: completion questions rendered as a radio button with the
    // single option "[Введите ответ]" — physically unanswerable.
    const t = mapDbToListeningTest(buildListeningTest());
    const completion = t.sections[0].questions[1];
    expect(completion.kind).toBe("text");
    expect(completion.options).toBeUndefined();
    expect(completion.expectedText).toBe("42");
    expect(completion.answer).toBeNull();
  });

  it("preserves audio_url and duration", () => {
    const t = mapDbToListeningTest(buildListeningTest());
    expect(t.audioUrl).toBe("https://example.com/listening/section-2.mp3");
    expect(t.duration).toBe(240);
  });

  it("represents tests without audio as audioUrl=null (UI should block instead of fake play)", () => {
    const t = mapDbToListeningTest(LISTENING_NO_AUDIO);
    expect(t.audioUrl).toBeNull();
  });

  it("handles missing/empty groups gracefully", () => {
    const t = mapDbToListeningTest({ id: "x", title: "X", question_groups: [] });
    expect(t.sections[0].questions).toEqual([]);
  });
});

describe("matchesText", () => {
  it("matches identical strings", () => {
    expect(matchesText("anchoring", "anchoring")).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(matchesText("  Anchoring ", "anchoring")).toBe(true);
    expect(matchesText("FITNESS CLASSES", "fitness classes")).toBe(true);
  });

  it("ignores trailing punctuation", () => {
    expect(matchesText("anchoring.", "anchoring")).toBe(true);
    expect(matchesText("anchoring", "anchoring,")).toBe(true);
  });

  it("rejects wrong answers", () => {
    expect(matchesText("anchored", "anchoring")).toBe(false);
  });

  it("returns false for missing expected", () => {
    expect(matchesText("anything", undefined)).toBe(false);
  });
});
