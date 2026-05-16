// ============================================================================
// Reading test data mapper
//
// Extracted from app/tests/reading/page.tsx so the mapping logic can be
// independently unit-tested. The page module previously contained a copy of
// this code that:
//   • collapsed all 3 IELTS passages into a single string (sections[0] only)
//   • silently defaulted free-text correct_answer to index 0, making the
//     first option always "correct"
//
// Both bugs are fixed here.
// ============================================================================

export type ReadingQuestionType = "mcq" | "tfng" | "matching" | "text";

export type TestQuestion = {
  id: string;
  type: ReadingQuestionType;
  instruction: string;
  text: string;
  options: string[];
  /** Index of the correct option, or `null` if the answer is free-text and
   *  the question is not auto-gradable client-side. */
  answer: number | null;
  expectedText?: string;
};

export type ReadingPassage = {
  id: string;
  partNumber: number;
  passageText: string;
  questions: TestQuestion[];
};

export type ReadingTest = {
  id: string;
  title: string;
  source: string | null;
  timeLimit: number;
  passages: ReadingPassage[];
};

/** Official IELTS Reading duration: 60 minutes for 3 passages / 40 questions. */
export const READING_TIME_LIMIT_SEC = 60 * 60;

/**
 * Convert a stored `correct_answer` string into the index of the matching
 * option, or `null` if no exact match is found.
 *
 * Why `null` (and not `0`): a `0` default silently turned every fill-in or
 * short-answer question into "option A is correct", producing wrong band
 * scores. `null` propagates "not auto-gradable" — the caller must decide
 * what to do (mark question manually, exclude from band calculation, …).
 *
 * Accepted answer formats:
 *   • single letters "A".."D" (case-insensitive) → index 0..3
 *   • full-text match against options (case-insensitive)
 *   • otherwise → null
 */
export function answerToIndex(
  answer: string | null | undefined,
  options: string[]
): number | null {
  if (!answer) return null;
  const upper = answer.trim().toUpperCase();
  if (!upper) return null;
  // Single-letter shortcut
  if (/^[A-J]$/.test(upper)) {
    const idx = upper.charCodeAt(0) - 65;
    return idx < options.length ? idx : null;
  }
  // Full-text match
  const idx = options.findIndex((o) => o.toUpperCase().trim() === upper);
  return idx >= 0 ? idx : null;
}

/** Parse `options` as it may arrive from the DB: array, object map, JSON string, or null. */
function parseOptions(raw: unknown, fallback: string[]): string[] {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, string>).map(String);
  }
  return fallback;
}

import { validateQuestionRow, normaliseAnswer } from "./content-filter";

const TFNG_OPTIONS = ["TRUE", "FALSE", "NOT GIVEN"];
const MCQ_OPTIONS = ["A", "B", "C", "D"];

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Map a raw Supabase response (reading_tests with nested sections,
 * question_groups, questions) to the shape consumed by the UI.
 *
 * Returns ALL passages (not just the first), each with its own questions.
 */
export function mapDbToReadingTest(raw: any): ReadingTest {
  const passages: ReadingPassage[] = [];
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  // Sort by part_number so passages always render in IELTS order.
  const sorted = [...sections].sort(
    (a, b) => (a?.part_number ?? 0) - (b?.part_number ?? 0)
  );

  for (const section of sorted) {
    const passage: ReadingPassage = {
      id: String(section.id ?? `section-${section.part_number ?? passages.length + 1}`),
      partNumber: Number(section.part_number ?? passages.length + 1),
      passageText: String(section.passage_text ?? ""),
      questions: [],
    };

    for (const group of section.reading_question_groups ?? []) {
      const instruction = (group.instruction as string) ?? "";
      const rawType = String(group.question_type ?? "mcq");
      const qType: ReadingQuestionType =
        rawType === "tfng"
          ? "tfng"
          : rawType === "matching"
            ? "matching"
            : rawType === "completion" || rawType === "short_answer"
              ? "text"
              : "mcq";
      for (const q of group.reading_questions ?? []) {
        // Skip rows that the legacy importer corrupted — see content-filter.ts
        // for the full taxonomy of "garbage row" patterns.
        const check = validateQuestionRow(q.question_text, q.correct_answer);
        if (!check.ok) continue;

        const opts = qType === "text"
          ? []
          : parseOptions(q.options, qType === "tfng" ? TFNG_OPTIONS : MCQ_OPTIONS);
        const correct = normaliseAnswer(q.correct_answer);
        passage.questions.push({
          id: String(q.id),
          type: qType,
          instruction,
          text: String(q.question_text ?? ""),
          options: opts,
          answer: qType === "text" ? null : answerToIndex(correct, opts),
          expectedText: qType === "text" ? correct : undefined,
        });
      }
    }
    passages.push(passage);
  }

  return {
    id: String(raw?.id ?? "unknown"),
    title: String(raw?.title ?? "Reading Test"),
    source: raw?.source ?? null,
    timeLimit: READING_TIME_LIMIT_SEC,
    passages,
  };
}

/** Total number of questions across all passages. */
export function countReadingQuestions(test: ReadingTest): number {
  return test.passages.reduce((sum, p) => sum + p.questions.length, 0);
}

/** Flat iterator over every auto-gradable (answer != null) question in the test. */
export function gradableQuestions(test: ReadingTest): TestQuestion[] {
  return test.passages
    .flatMap((p) => p.questions)
    .filter((q) => q.answer !== null || Boolean(q.expectedText));
}

/** Same normalization as Listening text answers: case-insensitive, trim, ignore trailing punctuation. */
export function matchesReadingText(userInput: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const norm = (s: string) => s.toLowerCase().trim().replace(/[.,!?;:]+$/g, "");
  return norm(userInput) === norm(expected);
}

export function isReadingAnswerCorrect(q: TestQuestion, userAnswer: number | string | undefined): boolean {
  if (q.type === "text") {
    return typeof userAnswer === "string" && matchesReadingText(userAnswer, q.expectedText);
  }
  return typeof userAnswer === "number" && q.answer !== null && userAnswer === q.answer;
}
