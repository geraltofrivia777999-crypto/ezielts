// ============================================================================
// Listening test data mapper
//
// Same fixes as reading.ts plus: completion / fill-in questions are now
// represented with `kind: "text"` (no options array) so the UI can render a
// real text input instead of a single fake radio button reading
// "[Введите ответ]" — a bug that made completion questions unanswerable.
// ============================================================================

import { answerToIndex } from "./reading";
import { validateQuestionRow, normaliseAnswer } from "./content-filter";
export { answerToIndex };

export type ListeningQuestionKind = "mcq" | "text";

export type ListeningQuestion = {
  id: string;
  kind: ListeningQuestionKind;
  instruction: string;
  text: string;
  /** Only present for `kind: "mcq"`. */
  options?: string[];
  /** For MCQ: index of correct option (or null if free-text was stored).
   *  For text questions: always null (answers are graded by string match
   *  against `expectedText`). */
  answer: number | null;
  /** For text questions: the expected free-text answer (case-insensitive
   *  string compare on submit). */
  expectedText?: string;
};

export type ListeningSection = {
  sectionNumber: number; // 1..4
  questions: ListeningQuestion[];
};

export type ListeningTest = {
  id: string;
  title: string;
  audioUrl: string | null;
  duration: number;
  sections: ListeningSection[];
};

/** Official IELTS Listening: 30 minutes audio + 10 minutes answer transfer.
 *  We don't strictly enforce transfer time in v1 — exposed for UI display. */
export const LISTENING_AUDIO_SEC = 30 * 60;
export const LISTENING_TRANSFER_SEC = 10 * 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

function parseOptions(raw: unknown): string[] | null {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (Array.isArray(value) && value.length > 0) return value.map(String);
  if (value && typeof value === "object") {
    const arr = Object.values(value as Record<string, string>).map(String);
    return arr.length > 0 ? arr : null;
  }
  return null;
}

export function mapDbToListeningTest(raw: any): ListeningTest {
  // The legacy schema returns one test = one section. Group by `section`
  // field if present, otherwise default everything to section 1.
  const sectionNumber = Number(raw?.section ?? 1);
  const questions: ListeningQuestion[] = [];

  for (const group of raw?.question_groups ?? []) {
    const instruction = (group.instruction as string) ?? "";
    const groupType: string = group.question_type ?? "mcq";

    for (const q of group.listening_questions ?? []) {
      // Same defensive filter as reading — see content-filter.ts.
      const check = validateQuestionRow(q.question_text, q.correct_answer);
      if (!check.ok) continue;

      const opts = parseOptions(q.options);
      const correct = normaliseAnswer(q.correct_answer);

      // If the group has explicit options → MCQ. Otherwise → text input.
      if (opts && opts.length > 0) {
        questions.push({
          id: String(q.id),
          kind: "mcq",
          instruction,
          text: String(q.question_text ?? ""),
          options: opts,
          answer: answerToIndex(correct, opts),
        });
      } else {
        // completion / short_answer / fill-in → free-text input
        questions.push({
          id: String(q.id),
          kind: "text",
          instruction,
          text: String(q.question_text ?? ""),
          answer: null,
          expectedText: correct,
        });
      }

      void groupType; // reserved for future per-type rendering hints
    }
  }

  return {
    id: String(raw?.id ?? "unknown"),
    title: String(raw?.title ?? "Listening Test"),
    audioUrl: raw?.audio_url ?? null,
    duration: Number(raw?.audio_duration ?? 240),
    sections: [{ sectionNumber, questions }],
  };
}

/** Check a user's free-text answer against the expected text.
 *  Case-insensitive, trim whitespace, ignore trailing punctuation. */
export function matchesText(userInput: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const norm = (s: string) => s.toLowerCase().trim().replace(/[.,!?;:]+$/g, "");
  return norm(userInput) === norm(expected);
}
