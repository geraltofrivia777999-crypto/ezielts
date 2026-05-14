// Realistic shapes of what Supabase returns for a reading_tests row with
// nested sections, question_groups, and questions. Used by mapping tests.

export type RawReadingTest = {
  id: string;
  title: string;
  source: string | null;
  sections: Array<{
    id: string;
    part_number: number;
    passage_text: string;
    reading_question_groups: Array<{
      id: string;
      question_type: "mcq" | "tfng" | "matching" | "completion" | "short_answer";
      instruction: string;
      reading_questions: Array<{
        id: string;
        question_text: string;
        options: unknown;
        correct_answer: string | null;
      }>;
    }>;
  }>;
};

/** Standard 3-passage IELTS Academic Reading test, mostly MCQ + TFNG. */
export function buildReadingTest(overrides: Partial<RawReadingTest> = {}): RawReadingTest {
  return {
    id: "rt-1",
    title: "Sample Academic Reading",
    source: "Cambridge IELTS 18",
    sections: [
      {
        id: "sec-1",
        part_number: 1,
        passage_text: "Passage 1 text about renewable energy. ".repeat(20),
        reading_question_groups: [
          {
            id: "g1",
            question_type: "mcq",
            instruction: "Choose the correct letter, A, B, C or D.",
            reading_questions: [
              {
                id: "q1",
                question_text: "What is the main idea of paragraph 1?",
                options: ["Solar power", "Wind power", "Hydroelectric", "All of the above"],
                correct_answer: "A",
              },
              {
                id: "q2",
                question_text: "Why was the project delayed?",
                options: ["Funding", "Weather", "Permits", "Public opposition"],
                correct_answer: "C",
              },
            ],
          },
        ],
      },
      {
        id: "sec-2",
        part_number: 2,
        passage_text: "Passage 2 text about urban planning. ".repeat(20),
        reading_question_groups: [
          {
            id: "g2",
            question_type: "tfng",
            instruction: "Do the following statements agree with the information given? Write TRUE, FALSE or NOT GIVEN.",
            reading_questions: [
              {
                id: "q3",
                question_text: "Cities with more green spaces have lower crime rates.",
                options: null,
                correct_answer: "TRUE",
              },
              {
                id: "q4",
                question_text: "The author lived in Paris during the 1990s.",
                options: null,
                correct_answer: "NOT GIVEN",
              },
            ],
          },
        ],
      },
      {
        id: "sec-3",
        part_number: 3,
        passage_text: "Passage 3 text about cognitive psychology. ".repeat(20),
        reading_question_groups: [
          {
            id: "g3",
            question_type: "completion",
            instruction: "Complete the sentences below. Write NO MORE THAN TWO WORDS for each answer.",
            reading_questions: [
              {
                id: "q5",
                question_text: "The phenomenon is known as the ____ effect.",
                options: null,
                correct_answer: "anchoring",
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** A test where options arrive as an object map { A: "...", B: "..." } from JSONB. */
export function buildReadingTestWithObjectOptions(): RawReadingTest {
  const base = buildReadingTest();
  base.sections[0].reading_question_groups[0].reading_questions[0].options = {
    A: "Solar power",
    B: "Wind power",
    C: "Hydroelectric",
    D: "All of the above",
  };
  return base;
}

/** A test where options are stored as a stringified JSON array. */
export function buildReadingTestWithStringOptions(): RawReadingTest {
  const base = buildReadingTest();
  base.sections[0].reading_question_groups[0].reading_questions[0].options =
    JSON.stringify(["Solar power", "Wind power", "Hydroelectric", "All"]);
  return base;
}

/** Edge cases for graceful degradation: empty / partial DB rows. */
export const READING_EMPTY_SECTIONS: RawReadingTest = {
  id: "empty",
  title: "Empty",
  source: null,
  sections: [],
};

export const READING_SECTIONS_OUT_OF_ORDER = (): RawReadingTest => {
  const t = buildReadingTest();
  // Reverse to confirm the mapper sorts by part_number
  t.sections = [...t.sections].reverse();
  return t;
};
