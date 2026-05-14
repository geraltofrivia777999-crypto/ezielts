"""
Tests for the mini-ielts.com Reading scraper.

Runs entirely against locally-saved HTML fixtures — no network. Refresh
fixtures with:

    curl -sL "https://mini-ielts.com/1518/reading/australian-artist-margaret-preston" \
         -o scripts/scrapers/tests/fixtures/reading_1518.html
    curl -sL "https://mini-ielts.com/1518/view-solution/reading/australian-artist-margaret-preston" \
         -o scripts/scrapers/tests/fixtures/solution_1518.html

Run: python3 -m unittest scripts.scrapers.tests.test_mini_ielts_parser -v
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scrapers.mini_ielts.parse_reading import parse_reading_test_html  # noqa: E402
from scrapers.mini_ielts.parse_solution import parse_solution_html  # noqa: E402
from scrapers.mini_ielts.validator import validate_test  # noqa: E402


FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class TestReadingParser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test = parse_reading_test_html(
            _load("reading_1518.html"),
            test_id="1518",
            slug="australian-artist-margaret-preston",
        )

    # ── Passage extraction ──────────────────────────────────────────────

    def test_title_extracted(self):
        self.assertEqual(self.test.title, "Australian artist Margaret Preston")

    def test_passage_has_substantial_text(self):
        # Real IELTS passages are ~4-6k chars
        self.assertGreater(len(self.test.passage_text), 3500)
        # Should contain known sentences
        self.assertIn("Margaret Preston", self.test.passage_text)
        self.assertIn("1875", self.test.passage_text)

    def test_passage_has_paragraph_breaks(self):
        # We join paragraphs with "\n\n" so the UI's split('\n\n') works
        self.assertGreater(self.test.passage_text.count("\n\n"), 3)

    def test_passage_excludes_ads_and_toolbars(self):
        # Negative checks: nothing from the toolbar/ads should leak in
        self.assertNotIn("Advertisement", self.test.passage_text)
        self.assertNotIn("Highlight Blue", self.test.passage_text)
        self.assertNotIn("Dictionary", self.test.passage_text)

    # ── Group + question extraction ────────────────────────────────────

    def test_two_question_groups(self):
        # Test 1518 has Questions 1-7 (TFNG) + Questions 8-13 (completion)
        self.assertEqual(len(self.test.groups), 2)

    def test_first_group_is_tfng(self):
        g = self.test.groups[0]
        self.assertEqual(g.question_type, "tfng")
        self.assertIn("TRUE", g.instruction.upper())
        self.assertEqual(len(g.questions), 7)
        for q in g.questions:
            self.assertEqual(q.options, ["TRUE", "FALSE", "NOT GIVEN"])
            self.assertEqual(q.kind, "tfng")

    def test_second_group_is_completion(self):
        g = self.test.groups[1]
        self.assertEqual(g.question_type, "completion")
        self.assertEqual(len(g.questions), 6)
        for q in g.questions:
            self.assertIsNone(q.options)
            self.assertEqual(q.kind, "completion")

    def test_question_text_is_meaningful(self):
        for g in self.test.groups:
            for q in g.questions:
                self.assertGreater(
                    len(q.question_text), 10,
                    f"Q{q.qid} text suspiciously short: {q.question_text!r}",
                )

    def test_no_placeholder_question_text(self):
        for g in self.test.groups:
            for q in g.questions:
                self.assertFalse(
                    q.question_text.strip() == f"Question {q.qid}",
                    f"Placeholder text for q{q.qid}",
                )

    def test_total_questions_matches_expected(self):
        self.assertEqual(self.test.total_questions, 13)

    def test_question_ids_are_sequential(self):
        all_qids = sorted(q.qid for g in self.test.groups for q in g.questions)
        self.assertEqual(all_qids, list(range(1, 14)))


class TestSolutionParser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.answers = parse_solution_html(_load("solution_1518.html"))

    def test_parses_all_13_answers(self):
        self.assertEqual(len(self.answers), 13)
        self.assertEqual(sorted(self.answers.keys()), list(range(1, 14)))

    def test_tfng_answers_are_uppercase(self):
        # First 7 questions are TFNG
        for qid in range(1, 8):
            ans = self.answers.get(qid, "")
            self.assertIn(ans.upper(), {"TRUE", "FALSE", "NOT GIVEN"},
                          f"q{qid} answer {ans!r} not in TFNG set")

    def test_completion_answers_preserve_case(self):
        # q8 onwards are completion — answers like "symbols", "titles", "stenciling"
        # which should NOT be uppercased
        for qid in range(8, 14):
            ans = self.answers[qid]
            # Lowercase words OR a number
            self.assertTrue(
                ans.islower() or ans.isdigit() or any(c.isdigit() for c in ans),
                f"q{qid} answer {ans!r} expected lowercase/numeric",
            )

    def test_specific_known_answers(self):
        # Spot-check against the live solution page
        self.assertEqual(self.answers[1], "TRUE")
        self.assertEqual(self.answers[2], "NOT GIVEN")
        self.assertEqual(self.answers[3], "FALSE")
        self.assertEqual(self.answers[8], "symbols")
        self.assertEqual(self.answers[10], "stenciling")
        self.assertEqual(self.answers[13], "400")


class TestValidator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test = parse_reading_test_html(
            _load("reading_1518.html"),
            test_id="1518",
            slug="australian-artist-margaret-preston",
        )
        cls.answers = parse_solution_html(_load("solution_1518.html"))

    def test_real_test_passes_validation(self):
        report = validate_test(self.test, self.answers)
        rejections = [i for i in report.issues if i.severity == "reject"]
        self.assertFalse(
            report.rejected,
            f"Real test should not be rejected. Issues: {rejections}",
        )

    def test_test_with_no_answers_is_rejected(self):
        report = validate_test(self.test, {})
        self.assertTrue(report.rejected)
        reasons = {i.reason for i in report.issues}
        self.assertIn("low_answer_coverage", reasons)

    def test_garbage_question_text_is_rejected(self):
        # Manually corrupt a question and re-validate
        from copy import deepcopy
        bad = deepcopy(self.test)
        bad.groups[0].questions[0].question_text = "Question 1"
        report = validate_test(bad, self.answers)
        self.assertTrue(report.rejected)
        reasons = {i.reason for i in report.issues}
        self.assertIn("placeholder", reasons)


if __name__ == "__main__":
    unittest.main(verbosity=2)
