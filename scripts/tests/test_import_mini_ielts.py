"""
Tests for `scripts/import_mini_ielts_reading.py` — the pure projection only.

These tests do NOT touch Supabase. They exercise `project_for_db` against
realistic scraper output (a hand-picked sample of three real mini-ielts
tests from the smoke run) and assert the projection has the exact shape
expected by `write_to_db` and by the Supabase schema CHECK constraints.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from import_mini_ielts_reading import (  # noqa: E402
    project_for_db,
    total_questions,
    _normalise_qtype,
)


# ─── Sample data: real scraper output for test 1518 (Margaret Preston) ──────
# Captured verbatim from `python3 scripts/scrape_mini_ielts_reading.py --limit 1`.
# Kept inline so the test has no external dependencies.

SAMPLE_1518 = {
    "test_id": "1518",
    "slug": "australian-artist-margaret-preston",
    "title": "Australian artist Margaret Preston",
    "passage_text": "Preston paragraph text…",
    "total_questions": 13,
    "groups": [
        {
            "range_label": "Questions 1 - 7",
            "instruction": "Do the following statements agree with the information given in Reading Passage?",
            "question_type": "tfng",
            "questions": [
                {"qid": 1, "question_text": "Artists in the German aesthetic tradition portrayed nature realistically.",
                 "options": ["TRUE", "FALSE", "NOT GIVEN"], "kind": "tfng"},
                {"qid": 2, "question_text": "Margaret attended a famous art college in Paris.",
                 "options": ["TRUE", "FALSE", "NOT GIVEN"], "kind": "tfng"},
            ],
        },
        {
            "range_label": "Questions 8 - 13",
            "instruction": "Complete the sentences below. Write NO MORE THAN TWO WORDS.",
            "question_type": "completion",
            "questions": [
                {"qid": 8, "question_text": "incorporated _____ and colours from Aboriginal art",
                 "options": None, "kind": "completion"},
                {"qid": 10, "question_text": "very old method of",
                 "options": None, "kind": "completion"},
                {"qid": 13, "question_text": "approximately ____ paintings produced",
                 "options": None, "kind": "completion"},
            ],
        },
    ],
    "answers": {
        "1": "TRUE",  "2": "NOT GIVEN", "8": "symbols", "10": "stenciling", "13": "400",
        # q11/q12 omitted on purpose to verify the projection only emits questions WITH answers
    },
}


SAMPLE_1542 = {
    "test_id": "1542",
    "slug": "william-gilbert-and-magnetism",
    "title": "William Gilbert and Magnetism",
    "passage_text": "Gilbert paragraph text…",
    "total_questions": 7,
    "groups": [
        {
            "range_label": "Questions 1-7",
            "instruction": "Choose the correct heading for each paragraph.",
            "question_type": "headings",  # → should be normalised to 'matching'
            "questions": [
                {"qid": 1, "question_text": "Paragraph A",
                 "options": ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"], "kind": "mcq"},
                {"qid": 2, "question_text": "Paragraph B",
                 "options": ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"], "kind": "mcq"},
            ],
        },
    ],
    "answers": {"1": "v", "2": "i"},
}


class TestProjection(unittest.TestCase):

    def test_test_row_has_required_fields(self):
        p = project_for_db(SAMPLE_1518)
        row = p["test_row"]
        self.assertEqual(row["external_id"], "miniielts_1518")
        self.assertEqual(row["source"], "mini-ielts")
        self.assertEqual(row["category"], "academic")
        self.assertIn("Margaret Preston", row["title"])

    def test_passage_text_preserved(self):
        p = project_for_db(SAMPLE_1518)
        self.assertTrue(p["passage_text"])
        self.assertIn("Preston", p["passage_text"])

    def test_groups_preserve_order_and_metadata(self):
        p = project_for_db(SAMPLE_1518)
        self.assertEqual(len(p["groups"]), 2)
        self.assertEqual(p["groups"][0]["question_type"], "tfng")
        self.assertEqual(p["groups"][0]["sort_order"], 0)
        self.assertEqual(p["groups"][1]["question_type"], "completion")
        self.assertEqual(p["groups"][1]["sort_order"], 1)

    def test_questions_only_emitted_when_answer_present(self):
        # SAMPLE_1518 has 3 completion questions but only 3 answers for q8/q10/q13.
        # q11 and q12 are not in answers — should be excluded.
        # Also q2 IS in answers (NOT GIVEN) so it should be emitted.
        p = project_for_db(SAMPLE_1518)
        all_qs = [q for g in p["groups"] for q in g["questions"]]
        sort_orders = sorted(q["sort_order"] for q in all_qs)
        self.assertEqual(sort_orders, [1, 2, 8, 10, 13])

    def test_correct_answer_casing_preserved(self):
        p = project_for_db(SAMPLE_1518)
        ans_by_sort = {q["sort_order"]: q["correct_answer"] for g in p["groups"] for q in g["questions"]}
        # TFNG → uppercased in source already
        self.assertEqual(ans_by_sort[1], "TRUE")
        self.assertEqual(ans_by_sort[2], "NOT GIVEN")
        # Completion → lowercase ORIGINAL casing preserved (regression: legacy importer uppercased)
        self.assertEqual(ans_by_sort[8], "symbols")
        self.assertEqual(ans_by_sort[10], "stenciling")
        self.assertEqual(ans_by_sort[13], "400")

    def test_completion_options_become_none(self):
        p = project_for_db(SAMPLE_1518)
        completion_qs = p["groups"][1]["questions"]
        for q in completion_qs:
            self.assertIsNone(q["options"], f"q{q['sort_order']} should have no options")

    def test_mcq_options_preserved(self):
        p = project_for_db(SAMPLE_1518)
        tfng_q = p["groups"][0]["questions"][0]
        self.assertEqual(tfng_q["options"], ["TRUE", "FALSE", "NOT GIVEN"])

    def test_qtype_normalisation_matching_headings(self):
        # 'headings' / 'heading' / 'matching' all map to schema's 'matching'
        p = project_for_db(SAMPLE_1542)
        self.assertEqual(p["groups"][0]["question_type"], "matching")

    def test_total_questions_helper(self):
        p = project_for_db(SAMPLE_1518)
        self.assertEqual(total_questions(p), 5)  # q1, q2, q8, q10, q13

    def test_question_text_length_clamped_to_2000(self):
        sample = {
            "test_id": "x", "slug": "x", "title": "X",
            "passage_text": "passage",
            "groups": [{"instruction": "", "question_type": "mcq",
                        "questions": [{"qid": 1, "question_text": "a" * 5000, "options": ["A", "B"], "kind": "mcq"}]}],
            "answers": {"1": "A"},
        }
        p = project_for_db(sample)
        self.assertEqual(len(p["groups"][0]["questions"][0]["question_text"]), 2000)

    def test_instruction_text_length_clamped_to_1000(self):
        sample = {
            "test_id": "x", "slug": "x", "title": "X", "passage_text": "p",
            "groups": [{"instruction": "i" * 2000, "question_type": "mcq",
                        "questions": [{"qid": 1, "question_text": "q", "options": ["A"], "kind": "mcq"}]}],
            "answers": {"1": "A"},
        }
        p = project_for_db(sample)
        self.assertEqual(len(p["groups"][0]["instruction"]), 1000)


class TestQTypeAlias(unittest.TestCase):
    def test_known_aliases(self):
        self.assertEqual(_normalise_qtype("tfng"), "tfng")
        self.assertEqual(_normalise_qtype("ynng"), "tfng")
        self.assertEqual(_normalise_qtype("headings"), "matching")
        self.assertEqual(_normalise_qtype("heading"), "matching")
        self.assertEqual(_normalise_qtype("MATCHING"), "matching")
        self.assertEqual(_normalise_qtype("completion"), "completion")
        self.assertEqual(_normalise_qtype("summary"), "completion")
        self.assertEqual(_normalise_qtype("sentence"), "completion")
        self.assertEqual(_normalise_qtype("short_answer"), "short_answer")
        self.assertEqual(_normalise_qtype("short-answer"), "short_answer")

    def test_unknown_falls_back_to_mcq(self):
        self.assertEqual(_normalise_qtype("weird"), "mcq")
        self.assertEqual(_normalise_qtype(""), "mcq")


if __name__ == "__main__":
    unittest.main(verbosity=2)
