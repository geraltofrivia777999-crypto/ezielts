"""
Offline tests for `scrapers/ielts_up/parse_{listening,writing,speaking}.py`.

Run with:
    python -m unittest scripts.scrapers.tests.test_ielts_up_parsers -v

Fixtures are saved HTML pages captured from ielts-up.com (committed under
fixtures/ielts_up/). The tests assert specific values from those pages so
any change in parser behaviour is caught.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent.parent  # repo root
sys.path.insert(0, str(ROOT / "scripts"))

from scrapers.ielts_up.parse_listening import parse_listening_html
from scrapers.ielts_up.parse_writing import parse_writing_topic_html
from scrapers.ielts_up.parse_speaking import parse_speaking_html

FIXTURES = Path(__file__).parent / "fixtures" / "ielts_up"


def _load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


# ─── LISTENING ──────────────────────────────────────────────────────────────


class TestListening(unittest.TestCase):

    def setUp(self):
        self.html = _load("ielts-listening-sample-10.1.html")
        self.parsed = parse_listening_html(self.html)

    def test_test_and_section_numbers(self):
        self.assertEqual(self.parsed.test_num, 10)
        self.assertEqual(self.parsed.section, 1)

    def test_title_extracted(self):
        self.assertIn("Sample 10", self.parsed.title)
        self.assertIn("Section 1", self.parsed.title)

    def test_mp3_filename_extracted(self):
        self.assertEqual(self.parsed.mp3_filename, "10.1.mp3")

    def test_mp3_absolute_url(self):
        self.assertEqual(
            self.parsed.mp3_absolute_url,
            "https://ielts-up.com/listening/10.1.mp3",
        )

    def test_answers_extracted_in_order(self):
        # From the fixture, answers should start with these in this exact order.
        self.assertGreater(len(self.parsed.answers), 5,
                           "expected at least 5 answers from sample 10.1")
        # First answer in the fixture is "Elsinore"
        self.assertEqual(self.parsed.answers[0], "Elsinore")
        self.assertEqual(self.parsed.answers[1], "077896245")

    def test_answer_count_typical_for_one_section(self):
        # IELTS Listening has ~10 questions per section
        self.assertGreaterEqual(len(self.parsed.answers), 6)
        self.assertLessEqual(len(self.parsed.answers), 12)

    def test_instruction_is_non_empty(self):
        # We should capture the form text between audio and answers
        self.assertTrue(self.parsed.instruction)
        self.assertGreater(len(self.parsed.instruction), 50)

    def test_instruction_does_not_leak_show_answers_button(self):
        self.assertNotIn("Show answers", self.parsed.instruction)


# ─── WRITING ───────────────────────────────────────────────────────────────


class TestWriting(unittest.TestCase):

    def setUp(self):
        self.html = _load("task-2-education-questions.html")
        self.prompts = parse_writing_topic_html(self.html, topic_slug="education")

    def test_multiple_prompts_extracted(self):
        # The fixture shows at least 5 numbered prompts (#1..#5)
        self.assertGreaterEqual(len(self.prompts), 5)

    def test_prompts_are_sequentially_numbered(self):
        indices = [p.prompt_index for p in self.prompts]
        self.assertEqual(indices, sorted(indices))
        self.assertEqual(indices[0], 1)

    def test_first_prompt_contains_expected_text(self):
        p1 = self.prompts[0]
        self.assertIn("students work while studying", p1.prompt_text)
        self.assertIn("What do you think are the causes", p1.prompt_text)

    def test_prompt_metadata_defaults(self):
        p = self.prompts[0]
        self.assertEqual(p.task_type, "task2")
        self.assertEqual(p.exam_type, "academic")
        self.assertEqual(p.min_words, 250)
        self.assertEqual(p.topic_slug, "education")

    def test_external_id_is_deterministic(self):
        # Same prompt → same external_id across runs
        p = self.prompts[0]
        self.assertEqual(p.external_id, "ieltsup_w_education_1")

    def test_prompts_have_no_navigation_leakage(self):
        for p in self.prompts:
            self.assertNotIn("Subscribe for free", p.prompt_text)
            self.assertNotIn("Back to the list", p.prompt_text)
            self.assertNotIn("< Back", p.prompt_text)

    def test_prompts_have_no_footer_leakage(self):
        # Regression: the last prompt on each topic page used to capture the
        # footer ("Tweet  Contact us  About the project  © ielts-up.com…")
        # because the footer regex required a leading newline.
        for p in self.prompts:
            self.assertNotIn("Tweet", p.prompt_text)
            self.assertNotIn("Contact us", p.prompt_text)
            self.assertNotIn("©", p.prompt_text)
            self.assertNotIn("About the project", p.prompt_text)


# ─── SPEAKING ──────────────────────────────────────────────────────────────


class TestSpeaking(unittest.TestCase):

    def setUp(self):
        self.html = _load("ielts-speaking-sample-1.html")
        self.parts = parse_speaking_html(self.html, override_slug="travel-holidays")

    def test_three_parts_extracted(self):
        part_nums = [p.part for p in self.parts]
        self.assertEqual(sorted(part_nums), [1, 2, 3])

    def test_topic_metadata_consistent(self):
        for p in self.parts:
            self.assertEqual(p.topic_slug, "travel-holidays")
            self.assertIn("Travel", p.topic_title)

    def test_external_id_pattern(self):
        ids = {p.part: p.external_id for p in self.parts}
        self.assertEqual(ids[1], "ieltsup_s_travel-holidays_p1")
        self.assertEqual(ids[2], "ieltsup_s_travel-holidays_p2")
        self.assertEqual(ids[3], "ieltsup_s_travel-holidays_p3")

    def test_part_1_has_questions(self):
        p1 = next(p for p in self.parts if p.part == 1)
        self.assertGreater(len(p1.questions), 0,
                           "Part 1 should have at least 1 question")
        for q in p1.questions:
            self.assertTrue(q.endswith("?"), f"Q1 entry not a question: {q!r}")

    def test_part_2_has_cue_card_text(self):
        p2 = next(p for p in self.parts if p.part == 2)
        self.assertTrue(p2.topic_text, "Part 2 topic_text empty")
        # Should describe something
        self.assertTrue(
            any(w in p2.topic_text.lower() for w in ("describe", "tell")),
            f"Part 2 lacks cue-card-style topic: {p2.topic_text[:120]}"
        )

    def test_part_2_cue_card_bullets_split(self):
        # Regression: the source layout uses a single <div> with no newlines
        # between bullets ("When you visited it Where is it situated Who you went with…").
        # The parser must split these into multiple cue_card_points using the
        # When/Where/Who/What lead-word heuristic.
        p2 = next(p for p in self.parts if p.part == 2)
        self.assertGreaterEqual(
            len(p2.cue_card_points), 2,
            f"Cue card bullets not split: {p2.cue_card_points!r}"
        )
        # No "You should say" leak into topic_text
        self.assertNotIn("You should say", p2.topic_text)

    def test_part_2_bullets_are_short_not_sample_answer(self):
        # Regression: bullets ended up including the entire sample answer
        # ("A couple of years ago I went on a holiday…") because the parser
        # didn't stop at the prose paragraph.
        p2 = next(p for p in self.parts if p.part == 2)
        for b in p2.cue_card_points:
            self.assertLess(
                len(b), 100,
                f"Cue card bullet too long (looks like sample answer): {b!r}"
            )
        # Cue card bullets should be just the 4 standard prompts (When/Where/Who/and)
        self.assertLessEqual(
            len(p2.cue_card_points), 6,
            f"Too many bullets — sample answer likely leaked: {p2.cue_card_points!r}"
        )

    def test_part_2_sample_answer_captured(self):
        # When the source page contains a sample answer after the cue card,
        # we should capture it separately in `sample_answer` so users can
        # study it without it polluting the cue-card display.
        p2 = next(p for p in self.parts if p.part == 2)
        self.assertTrue(p2.sample_answer, "Sample answer missing from Part 2")
        # Sample contains some longer-form prose
        self.assertGreater(len(p2.sample_answer or ""), 50)

    def test_part_3_has_questions(self):
        p3 = next(p for p in self.parts if p.part == 3)
        self.assertGreater(len(p3.questions), 0,
                           "Part 3 should have at least 1 discussion question")

    def test_no_part_is_completely_empty(self):
        for p in self.parts:
            has_content = bool(p.topic_text or p.questions or p.cue_card_points)
            self.assertTrue(has_content, f"Part {p.part} has no content at all")


if __name__ == "__main__":
    unittest.main(verbosity=2)
