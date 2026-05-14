// ============================================================================
// Small factories to build domain objects without ceremony.
// Use these in tests instead of hand-rolling object literals.
// ============================================================================

import type { AnalysisQuestion } from "@/components/error-analysis";

let qCounter = 0;
export function resetQuestionIds() { qCounter = 0; }

function nextId() { qCounter += 1; return `q${qCounter}`; }

/** Build an AnalysisQuestion. Defaults to a 4-option MCQ. */
export function makeAnalysisQuestion(
  partial: Partial<AnalysisQuestion> = {}
): AnalysisQuestion {
  return {
    id: partial.id ?? nextId(),
    instruction: partial.instruction,
    text: partial.text ?? "Sample question text",
    options: partial.options ?? ["A", "B", "C", "D"],
    answer: partial.answer ?? 0,
  };
}

/** Generate an essay-like string of approximately N words. */
export function makeEssay(approxWordCount: number, word = "word"): string {
  return Array(Math.max(0, approxWordCount)).fill(word).join(" ");
}

/** Build a Blob with arbitrary size (filled with zeros) and given mime type. */
export function makeAudioBlob(sizeBytes: number, mime = "audio/webm"): Blob {
  return new Blob([new Uint8Array(Math.max(0, sizeBytes))], { type: mime });
}
