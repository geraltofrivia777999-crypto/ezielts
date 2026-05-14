import { describe, it, expect } from "vitest";
import {
  validateQuestionRow,
  normaliseAnswer,
  parseSpeakingTopic,
} from "@/lib/test-mapping/content-filter";

describe("validateQuestionRow", () => {
  describe("rejects garbage from real screenshots", () => {
    // Each sample is taken verbatim from the user-reported broken UI.

    it("rejects the literal 'Question N' placeholder", () => {
      // Listening screenshot, rows #2 and #4.
      expect(validateQuestionRow("Question 4", "C").ok).toBe(false);
      expect(validateQuestionRow("Question 5", "B").ok).toBe(false);
      expect(validateQuestionRow("Question 13", "A").reason).toBe("placeholder");
    });

    it("rejects section / questions-range headers", () => {
      // Reading screenshot, row #1 of Passage 1 and listening screenshot row #3.
      expect(validateQuestionRow("Questions 19-22", "A").ok).toBe(false);
      expect(validateQuestionRow("Questions 23-26", "A").ok).toBe(false);
      expect(
        validateQuestionRow(
          "Section 1: Questions 1-5 Complete the table below using NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
          "C"
        ).ok
      ).toBe(false);
    });

    it("rejects instruction text stored as a question", () => {
      // Reading screenshot, row #1: instruction was put into question_text.
      expect(
        validateQuestionRow(
          "Question 13 Choose the correct letter A, B, C or D. Write the correct letter in box 13 on your answer sheet.",
          "A"
        ).ok
      ).toBe(false);
      expect(
        validateQuestionRow(
          "Complete each sentence with the correct ending A-G below. Write the correct letter A-G in boxes 23-26 on your answer sheet.",
          ""
        ).ok
      ).toBe(false);
    });

    it("rejects matching-endings ('A stick / B curl / C are …') stored as one question", () => {
      // Reading screenshot, row #4.
      expect(
        validateQuestionRow(
          "A stick to surfaces in and out of water. B curl up and down. C are washed and dried. D resist a pull of three times their body weight. E start to slip across the surface. F leave yellow footprints. G have hairy footpads.",
          ""
        ).ok
      ).toBe(false);
    });

    it("rejects multiple distinct questions glued together", () => {
      // Reading screenshot, row #2 of Passage 3.
      expect(
        validateQuestionRow(
          "23 Insect feet lose their sticking power when they 24 If you put ants on a rapidly rotating object, their feet 25 Beetles can stick to uneven surfaces because they 26 The toes on robots like Mecho-Gecko",
          ""
        ).ok
      ).toBe(false);
    });

    it("rejects table-completion prompts crammed into a single question", () => {
      // Listening screenshot, row #1.
      expect(
        validateQuestionRow(
          "Name of library Location Opening times Other information Bailey Library Parkville campus 8.30 am to (1)............pm weekdays Popular with students Brown Library Near Stratton Street and (2)................ 7 am to 2 am daily Open to (3)............students only RMIT Library Level 5, building 8, (4)..................Swan Street 10 am – 12 midnight Monday to Friday 10 am – (5)....................pm Saturdays and Sundays Good internet facilites",
          ""
        ).ok
      ).toBe(false);
    });

    it("rejects '(1) (2) (3) (4) (5)' fragment", () => {
      // Listening screenshot, row #5.
      expect(validateQuestionRow("(1) (2) (3) (4) (5)", "").ok).toBe(false);
    });

    it("rejects rows with no correct_answer", () => {
      expect(validateQuestionRow("What is the main idea?", "").reason).toBe("no_answer");
      expect(validateQuestionRow("What is the main idea?", null).reason).toBe("no_answer");
    });

    it("rejects empty / whitespace-only text", () => {
      expect(validateQuestionRow("", "A").reason).toBe("empty_text");
      expect(validateQuestionRow("   ", "A").reason).toBe("empty_text");
      expect(validateQuestionRow(null, "A").reason).toBe("empty_text");
    });
  });

  describe("accepts legitimate questions", () => {
    it("accepts a normal MCQ", () => {
      expect(
        validateQuestionRow(
          "According to the writer, what was the main reason the project succeeded?",
          "B"
        ).ok
      ).toBe(true);
    });

    it("accepts a TFNG statement", () => {
      expect(
        validateQuestionRow(
          "Solar panels were first installed in the village in 2008.",
          "NOT GIVEN"
        ).ok
      ).toBe(true);
    });

    it("accepts a completion-style question with a single blank", () => {
      // Single blank is fine — only 3+ blanks fail.
      expect(
        validateQuestionRow(
          "The phenomenon is known as the ____ effect.",
          "anchoring"
        ).ok
      ).toBe(true);
    });

    it("accepts a longer instruction-prefixed real question (not pure instruction)", () => {
      // If question is long (>200 chars) AND starts with a verb, we don't
      // assume it's an instruction — long passages are real prompts.
      const long =
        "Choose the correct letter A, B, C or D. " +
        "According to the writer, what is the most significant impact of artificial intelligence on the modern workplace? "
          .repeat(3);
      expect(validateQuestionRow(long, "A").ok).toBe(true);
    });
  });
});

describe("normaliseAnswer", () => {
  it("trims whitespace", () => {
    expect(normaliseAnswer("  TRUE  ")).toBe("TRUE");
  });

  it("returns empty string for null/undefined", () => {
    expect(normaliseAnswer(null)).toBe("");
    expect(normaliseAnswer(undefined)).toBe("");
  });

  it("preserves case (caller will compare case-insensitive)", () => {
    expect(normaliseAnswer("anchoring")).toBe("anchoring");
    expect(normaliseAnswer("Anchoring")).toBe("Anchoring");
  });
});

describe("parseSpeakingTopic", () => {
  it("parses a stringified JSON array into bullet points", () => {
    const raw = JSON.stringify([
      "What the book was about",
      "Why you decided to read it",
      "What you found most interesting",
    ]);
    const r = parseSpeakingTopic(raw);
    expect(r.bullets).toEqual([
      "What the book was about",
      "Why you decided to read it",
      "What you found most interesting",
    ]);
    expect(r.text).toContain("What the book was about");
  });

  it("recovers gracefully from a truncated '[' (regression: speaking screenshot)", () => {
    expect(parseSpeakingTopic("[")).toEqual({ text: "", bullets: null });
    expect(parseSpeakingTopic("]")).toEqual({ text: "", bullets: null });
    expect(parseSpeakingTopic("[]")).toEqual({ text: "", bullets: null });
  });

  it("passes through normal plain-text topics unchanged", () => {
    const r = parseSpeakingTopic("Describe a book you enjoyed reading recently.");
    expect(r.text).toBe("Describe a book you enjoyed reading recently.");
    expect(r.bullets).toBeNull();
  });

  it("strips brackets from malformed JSON-array remnants", () => {
    const r = parseSpeakingTopic('["unclosed bracket text');
    // Falls into the catch branch since this isn't valid JSON; strip + return.
    expect(r.text).toContain("unclosed");
  });

  it("returns empty for null/undefined/whitespace", () => {
    expect(parseSpeakingTopic(null).text).toBe("");
    expect(parseSpeakingTopic(undefined).text).toBe("");
    expect(parseSpeakingTopic("   ").text).toBe("");
  });
});
