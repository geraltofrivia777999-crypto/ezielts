import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorAnalysis, categorize } from "@/components/error-analysis";
import { makeAnalysisQuestion, resetQuestionIds } from "@/__tests__/helpers/factories";

beforeEach(() => resetQuestionIds());

describe("categorize", () => {
  // Realistic IELTS instruction strings — these are the exact phrases that
  // appear in Cambridge IELTS sample papers.
  const cases: Array<[string, string]> = [
    [
      "Do the following statements agree with the information given in Reading Passage 1? Write TRUE, FALSE or NOT GIVEN.",
      "True / False / Not Given",
    ],
    [
      "Do the following statements agree with the views of the writer? Write YES, NO or NOT GIVEN.",
      "Yes / No / Not Given",
    ],
    [
      "Reading Passage has six paragraphs, A–F. Match the headings below with the correct paragraph.",
      "Matching Headings",
    ],
    [
      "Match each statement with the correct researcher, A–E.",
      "Matching",
    ],
    [
      "Complete the summary below using words from the box.",
      "Summary Completion",
    ],
    [
      "Complete the sentence below with NO MORE THAN TWO WORDS from the passage.",
      "Sentence Completion",
    ],
    [
      "Answer the question below using NO MORE THAN THREE WORDS. Short answer questions.",
      "Short Answer",
    ],
    [
      "Choose the correct letter, A, B, C or D.",
      "Multiple Choice",
    ],
    [
      "Complete the notes below. Fill in the gaps with NO MORE THAN TWO WORDS.",
      "Gap Fill",
    ],
  ];

  it.each(cases)("classifies real IELTS instruction → %s", (instruction, expected) => {
    expect(categorize(instruction, "")).toBe(expected);
  });

  it("does not match Y/N/NG as T/F/NG (regression: regex order bug)", () => {
    // Earlier implementation matched on the substring "not given" alone,
    // so "YES, NO or NOT GIVEN" was incorrectly classified as TFNG.
    const yesNoInstr = "Write YES, NO or NOT GIVEN.";
    expect(categorize(yesNoInstr, "")).toBe("Yes / No / Not Given");
  });

  it("does not false-positive on stray words in the question text", () => {
    // Old bug: question text containing the word "no" or "true" leaked into
    // the matcher and triggered TFNG. The fix matches against instruction only.
    expect(categorize("Choose the correct letter, A, B, C or D.", "no team won the tournament that year")).toBe(
      "Multiple Choice"
    );
  });

  it("returns Other for unrecognised instructions", () => {
    expect(categorize("xyz qrs", "")).toBe("Other");
    expect(categorize(undefined, "asdf")).toBe("Other");
  });
});

describe("ErrorAnalysis component", () => {
  it("renders overall accuracy and per-category rows", () => {
    const questions = [
      makeAnalysisQuestion({ instruction: "TRUE, FALSE or NOT GIVEN", answer: 0 }),
      makeAnalysisQuestion({ instruction: "TRUE, FALSE or NOT GIVEN", answer: 1 }),
    ];
    const userAnswers = { [questions[0].id]: 0, [questions[1].id]: 2 }; // 1/2 correct
    render(<ErrorAnalysis questions={questions} userAnswers={userAnswers} />);
    expect(screen.getByText(/Анализ ошибок/)).toBeInTheDocument();
    expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
  });

  it("surfaces a weakness only when accuracy < 70% AND ≥ 2 questions in category", () => {
    const tfng = (i: number, ans: number) =>
      makeAnalysisQuestion({ id: `t${i}`, instruction: "TRUE, FALSE or NOT GIVEN", answer: ans });
    const questions = [tfng(1, 0), tfng(2, 1), tfng(3, 2)]; // 3 wrong / 3
    const userAnswers = { t1: 2, t2: 0, t3: 1 };
    render(<ErrorAnalysis questions={questions} userAnswers={userAnswers} />);
    expect(screen.getByText(/Слабые места/)).toBeInTheDocument();
  });

  it("hides weakness section when there is only one question in a category", () => {
    const questions = [makeAnalysisQuestion({ instruction: "Fill in the gaps", answer: 0 })];
    const userAnswers = { [questions[0].id]: 2 };
    render(<ErrorAnalysis questions={questions} userAnswers={userAnswers} />);
    expect(screen.queryByText(/Слабые места/)).not.toBeInTheDocument();
  });

  it("shows strength chips for categories ≥ 80% accuracy", () => {
    const mcq = (i: number) =>
      makeAnalysisQuestion({ id: `m${i}`, instruction: "Choose the correct letter, A, B, C or D.", answer: 0 });
    const questions = [mcq(1), mcq(2)];
    render(<ErrorAnalysis questions={questions} userAnswers={{ m1: 0, m2: 0 }} />);
    expect(screen.getAllByText(/Multiple Choice/).length).toBeGreaterThan(0);
  });
});
