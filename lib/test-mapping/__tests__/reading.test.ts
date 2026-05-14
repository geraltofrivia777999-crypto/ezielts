import { describe, it, expect } from "vitest";
import {
  mapDbToReadingTest,
  answerToIndex,
  countReadingQuestions,
  gradableQuestions,
  READING_TIME_LIMIT_SEC,
} from "@/lib/test-mapping/reading";
import {
  buildReadingTest,
  buildReadingTestWithObjectOptions,
  buildReadingTestWithStringOptions,
  READING_EMPTY_SECTIONS,
  READING_SECTIONS_OUT_OF_ORDER,
} from "@/__tests__/fixtures/reading";

describe("answerToIndex", () => {
  const opts = ["Alpha", "Beta", "Gamma", "Delta"];

  it("decodes single letters A-D to index 0-3", () => {
    expect(answerToIndex("A", opts)).toBe(0);
    expect(answerToIndex("b", opts)).toBe(1);
    expect(answerToIndex("  C ", opts)).toBe(2);
    expect(answerToIndex("D", opts)).toBe(3);
  });

  it("falls back to full-text match (case/space insensitive)", () => {
    expect(answerToIndex("beta", opts)).toBe(1);
    expect(answerToIndex("GAMMA", opts)).toBe(2);
  });

  it("matches TFNG options by full text", () => {
    const tfng = ["TRUE", "FALSE", "NOT GIVEN"];
    expect(answerToIndex("TRUE", tfng)).toBe(0);
    expect(answerToIndex("not given", tfng)).toBe(2);
  });

  it("returns null for free-text answers with no matching option (regression: was 0)", () => {
    // This was the silent failure: a completion answer "Paris" against
    // ["A","B","C","D"] options was returning 0, making the first option
    // always "correct" and producing fake band scores.
    expect(answerToIndex("Paris", opts)).toBeNull();
    expect(answerToIndex("anchoring", ["TRUE", "FALSE", "NOT GIVEN"])).toBeNull();
  });

  it("returns null for empty / whitespace / null / undefined", () => {
    expect(answerToIndex("", opts)).toBeNull();
    expect(answerToIndex("   ", opts)).toBeNull();
    expect(answerToIndex(null, opts)).toBeNull();
    expect(answerToIndex(undefined, opts)).toBeNull();
  });

  it("returns null for a letter beyond the options range", () => {
    // "D" against 3-option list (A/B/C) → out of bounds
    expect(answerToIndex("D", ["A", "B", "C"])).toBeNull();
  });
});

describe("mapDbToReadingTest", () => {
  it("returns ALL passages, not just the first (regression)", () => {
    const result = mapDbToReadingTest(buildReadingTest());
    expect(result.passages).toHaveLength(3);
    expect(result.passages[0].passageText).toContain("renewable energy");
    expect(result.passages[1].passageText).toContain("urban planning");
    expect(result.passages[2].passageText).toContain("cognitive psychology");
  });

  it("preserves part_number and sorts passages in IELTS order", () => {
    const result = mapDbToReadingTest(READING_SECTIONS_OUT_OF_ORDER());
    expect(result.passages.map((p) => p.partNumber)).toEqual([1, 2, 3]);
  });

  it("attaches each question to its passage (not flattened globally)", () => {
    const result = mapDbToReadingTest(buildReadingTest());
    expect(result.passages[0].questions).toHaveLength(2);
    expect(result.passages[1].questions).toHaveLength(2);
    expect(result.passages[2].questions).toHaveLength(1);
  });

  it("converts MCQ options correctly with correct answer indexing", () => {
    const result = mapDbToReadingTest(buildReadingTest());
    const q1 = result.passages[0].questions[0];
    expect(q1.type).toBe("mcq");
    expect(q1.options).toEqual(["Solar power", "Wind power", "Hydroelectric", "All of the above"]);
    expect(q1.answer).toBe(0);
  });

  it("converts TFNG questions with the standard option triplet", () => {
    const result = mapDbToReadingTest(buildReadingTest());
    const q = result.passages[1].questions[0];
    expect(q.type).toBe("tfng");
    expect(q.options).toEqual(["TRUE", "FALSE", "NOT GIVEN"]);
    expect(q.answer).toBe(0);
  });

  it("marks completion questions as answer=null (not auto-gradable)", () => {
    const result = mapDbToReadingTest(buildReadingTest());
    const q = result.passages[2].questions[0]; // completion
    expect(q.answer).toBeNull();
  });

  it("handles options stored as an object map { A: ..., B: ... }", () => {
    const result = mapDbToReadingTest(buildReadingTestWithObjectOptions());
    expect(result.passages[0].questions[0].options).toEqual([
      "Solar power", "Wind power", "Hydroelectric", "All of the above",
    ]);
  });

  it("handles options stored as a JSON string", () => {
    const result = mapDbToReadingTest(buildReadingTestWithStringOptions());
    expect(result.passages[0].questions[0].options).toEqual([
      "Solar power", "Wind power", "Hydroelectric", "All",
    ]);
  });

  it("returns a well-formed empty test when sections are missing", () => {
    const result = mapDbToReadingTest(READING_EMPTY_SECTIONS);
    expect(result.passages).toEqual([]);
    expect(result.timeLimit).toBe(READING_TIME_LIMIT_SEC);
  });

  it("does not crash on null/undefined input", () => {
    expect(() => mapDbToReadingTest(null)).not.toThrow();
    expect(() => mapDbToReadingTest(undefined)).not.toThrow();
    expect(() => mapDbToReadingTest({})).not.toThrow();
  });
});

describe("countReadingQuestions / gradableQuestions", () => {
  it("counts every question across all passages", () => {
    const t = mapDbToReadingTest(buildReadingTest());
    expect(countReadingQuestions(t)).toBe(5);
  });

  it("gradableQuestions excludes free-text (answer=null) questions", () => {
    const t = mapDbToReadingTest(buildReadingTest());
    const gradable = gradableQuestions(t);
    // 5 total questions, 1 is completion (free-text) → 4 gradable
    expect(gradable).toHaveLength(4);
    for (const q of gradable) expect(q.answer).not.toBeNull();
  });
});
