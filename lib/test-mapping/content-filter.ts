// ============================================================================
// Content-validation filter for imported IELTS questions.
//
// Why this exists: the legacy import script (`scripts/import_to_supabase.py`)
// has six known bugs that produce garbage rows in `reading_questions` /
// `listening_questions`:
//
//   1. Per-passage loop nests question_groups inside passages → every group
//      and every question is duplicated 3× (once per passage).
//   2. `q_texts` is a flat list of ALL blocks (instructions + options +
//      question texts), then mapped 1:1 with question numbers → questions
//      get random text from the wrong block.
//   3. Fallback `f"Question {qnum}"` is stored as question_text when blocks
//      run short — produces literal "Question 4", "Question 5" rows.
//   4. Matching-task answer endings ("A stick to surfaces. B curl up. …")
//      are stored as a single question_text rather than as `options`.
//   5. Instruction headers ("Questions 19-22", "Section 1:", "Complete the
//      table below…") leak into question_text.
//   6. correct_answer is force-uppercased — completion answers like
//      "anchoring" become "ANCHORING", breaking case-insensitive matching.
//
// Until we rewrite the importer and re-seed, this module hides the worst
// garbage from the UI so users see fewer broken questions instead of all 36.
//
// Each predicate returns `true` if the row should be HIDDEN (it's garbage),
// `false` if it's safe to render.
// ============================================================================

/** Headers / section labels that some importer wrote into question_text. */
const HEADER_PATTERNS: RegExp[] = [
  /^\s*Section\s+\d+\s*[:.]?\s*$/i,
  /^\s*Section\s+\d+\s*[:.]\s*Questions?\s+\d+\s*[-–]\s*\d+/i,
  /^\s*Questions?\s+\d+\s*[-–]\s*\d+\s*$/i,
  /^\s*Part\s+\d+\s*[:.]?\s*$/i,
];

/** Instructions that should live in `instruction`, not `question_text`. */
const INSTRUCTION_PATTERNS: RegExp[] = [
  /^\s*(?:Choose|Write|Complete|Decide|Match|Read|Select|Look\s+at|Answer)\s+(?:the|each|whether|YES|NO|TRUE|FALSE)/i,
  // Importer bug: "Question N Choose the correct letter…" — instruction was
  // concatenated with the question number when stored.
  /^\s*Questions?\s+\d+\s+(?:Choose|Write|Complete|Decide|Match|Read|Select|Look|Answer)\s+(?:the|each|whether|correct|YES|NO|TRUE|FALSE)/i,
  /^\s*Reading\s+Passage\s+\d/i,
  /^\s*Listen(?:ing)?\s+(?:to|and)/i,
  /NO\s+MORE\s+THAN\s+(?:ONE|TWO|THREE)\s+WORDS?/i, // word-limit notes
];

/** The legacy fallback the script writes when it runs out of block text. */
const QUESTION_N_FALLBACK = /^\s*Question\s+\d+\s*$/i;

/** Detects "multiple questions glued into one" — e.g. "23 Insect feet … 24 If you put …". */
function looksLikeMultipleGluedQuestions(text: string): boolean {
  // Two or more bare integer markers (5–80) followed by capitalised words,
  // with the markers separated by at least 8 chars of content.
  const matches = [...text.matchAll(/(?:^|\s)(\d{1,2})\s+[A-Z][a-z]/g)];
  if (matches.length < 2) return false;
  // Require gap between markers, to avoid catching "12 Apostles" etc.
  for (let i = 1; i < matches.length; i++) {
    const a = matches[i - 1].index ?? 0;
    const b = matches[i].index ?? 0;
    if (b - a >= 20) return true;
  }
  return false;
}

/** Detects "A stick … B curl … C are …" answer-endings stuffed into one text. */
function looksLikeMatchingEndingsList(text: string): boolean {
  // Three or more "X <word>" letter-prefixed clauses where X is A-G.
  const matches = text.match(/(?:^|\s)[A-G]\s+[a-z][a-z]+/g);
  return !!matches && matches.length >= 3;
}

/** Detects "table-completion with 5+ blanks crammed into one row" — e.g.
 *  "Name … (1)…pm … (2)… 7 am … (3)…students" */
function looksLikeMultiBlankPrompt(text: string): boolean {
  const blanks = text.match(/\(\d+\)/g);
  return !!blanks && blanks.length >= 3;
}

/** A row is rejected if any predicate flags it. */
export interface FilterResult {
  ok: boolean;
  reason?: string;
}

export function validateQuestionRow(
  questionText: string | null | undefined,
  correctAnswer: string | null | undefined
): FilterResult {
  const text = (questionText ?? "").trim();

  // Hard fail: empty text.
  if (text.length < 3) return { ok: false, reason: "empty_text" };

  // Hard fail: "Question N" placeholder from the importer's fallback.
  if (QUESTION_N_FALLBACK.test(text)) return { ok: false, reason: "placeholder" };

  // Hard fail: section/range header leaked into question text.
  if (HEADER_PATTERNS.some((p) => p.test(text))) return { ok: false, reason: "header" };

  // Hard fail: instruction text stored as a question.
  if (text.length < 200 && INSTRUCTION_PATTERNS.some((p) => p.test(text))) {
    return { ok: false, reason: "instruction" };
  }

  // Hard fail: matching-endings stuffed in (the "A stick / B curl / C are" pattern).
  if (looksLikeMatchingEndingsList(text)) return { ok: false, reason: "matching_endings" };

  // Hard fail: multiple distinct questions glued together.
  if (looksLikeMultipleGluedQuestions(text)) return { ok: false, reason: "multi_glued" };

  // Hard fail: table-prompt with many blanks crammed as one question.
  if (looksLikeMultiBlankPrompt(text)) return { ok: false, reason: "multi_blank_table" };

  // Soft fail: no correct_answer at all → cannot grade.
  const ans = (correctAnswer ?? "").trim();
  if (!ans) return { ok: false, reason: "no_answer" };

  return { ok: true };
}

/**
 * Normalise a `correct_answer` field that may have been force-uppercased
 * by the legacy importer. For completion-style answers (multi-word, mixed
 * case usually), the upper-case form is still acceptable for the
 * case-insensitive comparator used at grading time.
 *
 * For now we just trim — exported for symmetry & a future improvement that
 * will look up the original casing in the source JSON when available.
 */
export function normaliseAnswer(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

/**
 * Speaking topic_text often arrives as a stringified JSON array — e.g.
 * `'["What the book was about","Why you read it",…]'`. The importer
 * stored this raw, so the UI shows a literal `[` as the cue card text.
 *
 * Returns either:
 *   • the parsed array (caller renders it as bullet points), or
 *   • the original string with leading/trailing brackets stripped if it
 *     looks like a malformed JSON-array remnant, or
 *   • the original string unchanged.
 */
export function parseSpeakingTopic(raw: string | null | undefined): {
  text: string;
  bullets: string[] | null;
} {
  const s = (raw ?? "").trim();
  if (!s) return { text: "", bullets: null };

  // Looks like a JSON array → try parse
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((x) => typeof x === "string" && x.trim())
      ) {
        return { text: parsed.join(" • "), bullets: parsed };
      }
      // Empty array → empty result
      if (Array.isArray(parsed) && parsed.length === 0) {
        return { text: "", bullets: null };
      }
    } catch {
      // Strip the brackets and any trailing JSON garbage; better than showing "["
      const stripped = s.replace(/^\[\s*"?/, "").replace(/"?\s*\]$/, "").trim();
      return { text: stripped || s, bullets: null };
    }
  }
  // Looks like a JSON array that was truncated at the source ("[" only)
  if (s === "[" || s === "]" || s === "[]" || s === '""') {
    return { text: "", bullets: null };
  }
  return { text: s, bullets: null };
}
