export type RawListeningTest = {
  id: string;
  title: string;
  section: number;
  audio_url: string | null;
  audio_duration: number;
  question_groups: Array<{
    id: string;
    question_type: "mcq" | "completion" | "matching" | "short_answer";
    instruction: string;
    listening_questions: Array<{
      id: string;
      question_text: string;
      options: unknown;
      correct_answer: string | null;
    }>;
  }>;
};

export function buildListeningTest(overrides: Partial<RawListeningTest> = {}): RawListeningTest {
  return {
    id: "lt-1",
    title: "Section 2: Community Centre",
    section: 2,
    audio_url: "https://example.com/listening/section-2.mp3",
    audio_duration: 240,
    question_groups: [
      {
        id: "lg1",
        question_type: "mcq",
        instruction: "Choose the correct letter, A, B or C.",
        listening_questions: [
          {
            id: "l1",
            question_text: "What time does the pool close on Saturdays?",
            options: ["8pm", "9pm", "6pm"],
            correct_answer: "C",
          },
        ],
      },
      {
        id: "lg2",
        question_type: "completion",
        instruction: "Complete the notes. Write NO MORE THAN TWO WORDS for each answer.",
        listening_questions: [
          {
            id: "l2",
            question_text: "Adult membership costs £____ per month.",
            options: null,
            correct_answer: "42",
          },
          {
            id: "l3",
            question_text: "The new app lets you book ____ in advance.",
            options: null,
            correct_answer: "fitness classes",
          },
        ],
      },
    ],
    ...overrides,
  };
}

export const LISTENING_NO_AUDIO: RawListeningTest = {
  ...buildListeningTest(),
  audio_url: null,
};
