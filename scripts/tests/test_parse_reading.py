"""
Tests for `scripts/parsers/reading_parser.py`.

The tests run against the REAL `practicepteonline_reading.json` so we know
the parser produces good rows from the actual source — not a synthetic
fixture. The file lives outside this repo at:
    ../ChinaENG/practicepteonline_reading.json

Run with:
    cd <repo>
    python -m pytest scripts/tests/ -v
    # or
    python -m unittest scripts/tests/test_parse_reading.py
"""
import json
import os
import re
import sys
import unittest
from pathlib import Path

# Make the parsers package importable
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from parsers.reading_parser import (  # noqa: E402
    parse_reading_test,
    parse_reading_file,
    detect_question_type,
    strip_html,
    _split_glued_questions,
    _parse_option_list,
    _normalise_answer,
)

# Try a few likely locations for the source file
def _find_source_json() -> Path | None:
    candidates = [
        ROOT.parent / "ChinaENG" / "practicepteonline_reading.json",
        ROOT.parent.parent / "ChinaENG" / "practicepteonline_reading.json",
        Path.home() / "PycharmProjects" / "ChinaENG" / "practicepteonline_reading.json",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


SOURCE = _find_source_json()


class TestPureHelpers(unittest.TestCase):
    """Unit tests for helper functions — no dependency on the source JSON."""

    def test_strip_html_basic(self):
        self.assertEqual(strip_html("<p>Hello <b>world</b></p>"), "Hello world")
        self.assertEqual(strip_html("a&amp;b"), "a&b")
        self.assertEqual(strip_html(None), "")
        self.assertEqual(strip_html(""), "")

    def test_detect_question_type(self):
        self.assertEqual(
            detect_question_type("Write TRUE, FALSE or NOT GIVEN"), "tfng"
        )
        self.assertEqual(
            detect_question_type("Do statements agree? Write YES, NO or NOT GIVEN"),
            "tfng",
        )
        self.assertEqual(detect_question_type("Match the headings"), "matching")
        self.assertEqual(
            detect_question_type("Complete the summary below"), "completion"
        )
        self.assertEqual(
            detect_question_type("Choose the correct letter A B C or D"), "mcq"
        )

    def test_split_glued_questions(self):
        text = "1 First question? 2 Second question? 3 Third question?"
        out = _split_glued_questions(text, 1, 3)
        self.assertEqual(out[1], "First question?")
        self.assertEqual(out[2], "Second question?")
        self.assertEqual(out[3], "Third question?")

    def test_split_glued_ignores_numbers_in_text(self):
        # "10,000" should not trigger a split
        text = "1 A team of 10 scientists studied 50 samples. 2 The result was 5 percent."
        out = _split_glued_questions(text, 1, 2)
        self.assertEqual(len(out), 2)
        self.assertIn("team of 10 scientists", out[1])

    def test_split_glued_respects_range(self):
        text = "1 First 2 Second 3 Third 4 Fourth"
        out = _split_glued_questions(text, 2, 3)
        self.assertNotIn(1, out)
        self.assertNotIn(4, out)
        self.assertEqual(out[2], "Second")
        self.assertEqual(out[3], "Third")

    def test_parse_option_list(self):
        text = "A Edmond Halley B Johannes Kepler C Guillaume Le Gentil D Johann Franz Encke"
        self.assertEqual(
            _parse_option_list(text),
            ["Edmond Halley", "Johannes Kepler", "Guillaume Le Gentil", "Johann Franz Encke"],
        )

    def test_parse_option_list_handles_punctuation(self):
        self.assertEqual(_parse_option_list("A foo, B bar."), ["foo", "bar"])

    def test_parse_option_list_empty_on_no_match(self):
        self.assertEqual(_parse_option_list("just plain text no letters"), [])

    def test_normalise_answer_preserves_completion_casing(self):
        self.assertEqual(_normalise_answer("anchoring"), "anchoring")
        self.assertEqual(_normalise_answer("slow (turning)"), "slow (turning)")

    def test_normalise_answer_uppercases_letters_and_tfng(self):
        self.assertEqual(_normalise_answer("a"), "A")
        self.assertEqual(_normalise_answer("true"), "TRUE")
        self.assertEqual(_normalise_answer("not given"), "NOT GIVEN")
        self.assertEqual(_normalise_answer("yes"), "YES")


@unittest.skipIf(SOURCE is None, "source JSON not found")
class TestParsingRealJson(unittest.TestCase):
    """End-to-end tests on the actual practicepteonline_reading.json."""

    @classmethod
    def setUpClass(cls):
        with open(SOURCE) as f:
            cls.raw = json.load(f)

    # Helpers
    def _all_questions(self, parsed):
        for p in parsed.passages:
            for g in p.groups:
                for q in g.questions:
                    yield q

    # ── Structural invariants ──────────────────────────────────────────────

    def test_first_test_parses_with_three_passages(self):
        parsed = parse_reading_test(self.raw[0])
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed.passages), 3)
        for p in parsed.passages:
            self.assertTrue(p.passage_text, "passage_text should not be empty")
            self.assertGreater(len(p.passage_text), 500)
            self.assertGreater(len(p.groups), 0, "passage has no groups")

    def test_no_question_text_is_a_placeholder(self):
        """The legacy bug stored literal 'Question N' as question_text."""
        for item in self.raw[:30]:
            parsed = parse_reading_test(item)
            if not parsed:
                continue
            for q in self._all_questions(parsed):
                self.assertFalse(
                    re.fullmatch(r"\s*Question\s+\d+\s*", q.question_text),
                    f"Placeholder leaked: {q.question_text!r}",
                )

    def test_no_question_text_is_a_section_header(self):
        for item in self.raw[:30]:
            parsed = parse_reading_test(item)
            if not parsed:
                continue
            for q in self._all_questions(parsed):
                self.assertFalse(
                    re.match(r"^\s*Questions?\s+\d+\s*[-–]\s*\d+\s*$", q.question_text),
                    f"Header leaked: {q.question_text!r}",
                )

    def test_no_question_text_is_an_instruction(self):
        """E.g. 'Choose the correct letter A, B, C or D' should not be a question."""
        for item in self.raw[:30]:
            parsed = parse_reading_test(item)
            if not parsed:
                continue
            for q in self._all_questions(parsed):
                if len(q.question_text) < 150:
                    self.assertFalse(
                        re.match(
                            r"^\s*(Choose|Write|Complete|Decide|Match|Read|Select|Answer)\s+(the|each|whether|YES|NO|TRUE|FALSE)",
                            q.question_text,
                            re.I,
                        ),
                        f"Instruction leaked: {q.question_text!r}",
                    )

    def test_no_question_glues_multiple_q_markers(self):
        """The single-row '23 X 24 Y 25 Z' bug must not return."""
        for item in self.raw[:30]:
            parsed = parse_reading_test(item)
            if not parsed:
                continue
            for q in self._all_questions(parsed):
                # Count question-number markers in the parsed text. Must be 0 or 1.
                markers = re.findall(r"(?:^|\s)\d{1,2}\s+[A-Z][a-z]", q.question_text)
                self.assertLess(
                    len(markers), 3,
                    f"Glued questions in row: {q.question_text!r}",
                )

    def test_correct_answer_never_empty(self):
        for item in self.raw[:30]:
            parsed = parse_reading_test(item)
            if not parsed:
                continue
            for q in self._all_questions(parsed):
                self.assertTrue(q.correct_answer.strip(),
                                f"Empty correct_answer for {q.question_text!r}")

    def test_completion_answer_preserves_casing(self):
        """If the source answer is 'anchoring', we must NOT store 'ANCHORING'.

        TFNG/YNNG and single-letter answers are EXPECTED to be uppercased —
        skip them and only check multi-word lowercase completion answers.
        """
        TFNG_LIKE = {"true", "false", "not given", "yes", "no"}
        found = False
        for item in self.raw[:60]:
            for q_str, a in (item.get("answers") or {}).items():
                if not isinstance(a, str):
                    continue
                a_lower = a.lower().strip()
                # Skip TFNG/YNNG (rightfully uppercased) and single letters
                if a_lower in TFNG_LIKE:
                    continue
                if len(a_lower) == 1 and a_lower.isalpha():
                    continue
                # Only multi-word lowercase free-text answers
                if not a.islower() or len(a) < 4:
                    continue
                found = True
                parsed = parse_reading_test(item)
                if not parsed:
                    continue
                for q in self._all_questions(parsed):
                    if q.sort_order == int(q_str):
                        self.assertEqual(q.correct_answer, a,
                            f"Casing lost for q{q_str}: got {q.correct_answer!r}")
        if not found:
            self.skipTest("no lower-case completion answers in sample range")

    def test_options_never_contain_questions(self):
        """Bug #4 mixed multiple questions' options into a flat list."""
        for item in self.raw[:30]:
            parsed = parse_reading_test(item)
            if not parsed:
                continue
            for q in self._all_questions(parsed):
                if not q.options:
                    continue
                self.assertLessEqual(len(q.options), 10,
                    f"Too many options for q{q.sort_order}: {len(q.options)}")
                for o in q.options:
                    # Options shouldn't contain question-number markers
                    self.assertFalse(
                        re.search(r"\b\d{1,2}\s+[A-Z][a-z]", o),
                        f"Option contains question marker: {o!r}",
                    )

    # ── Smoke test on a wider sample ──────────────────────────────────────

    def test_first_100_tests_parse_without_exceptions(self):
        ok = 0
        for item in self.raw[:100]:
            try:
                parsed = parse_reading_test(item)
                if parsed and parsed.passages:
                    ok += 1
            except Exception as e:  # noqa: BLE001
                self.fail(f"Parser threw on item {item.get('slug')!r}: {e}")
        # At least 80% of the first 100 tests should produce usable content.
        self.assertGreaterEqual(ok, 80, f"Only {ok}/100 tests parsed cleanly")


if __name__ == "__main__":
    unittest.main(verbosity=2)
