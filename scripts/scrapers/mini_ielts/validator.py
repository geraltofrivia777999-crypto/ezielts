"""
Quality validator for parsed mini-ielts tests.

Mirrors the JS content-filter rules in `lib/test-mapping/content-filter.ts`
so that anything we'd hide in the UI is rejected at scrape time instead
of polluting the DB.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from .parse_reading import MIReadingTest, MIQuestion


# ─── Predicates (must mirror lib/test-mapping/content-filter.ts) ────────────

_PLACEHOLDER_PATTERN = re.compile(r"^\s*Question\s+\d+\s*$", re.I)
_HEADER_PATTERNS = [
    re.compile(r"^\s*Section\s+\d+\s*[:.]?\s*$", re.I),
    re.compile(r"^\s*Questions?\s+\d+\s*[-–]\s*\d+\s*$", re.I),
]
_INSTRUCTION_PATTERNS = [
    re.compile(
        r"^\s*(?:Choose|Write|Complete|Decide|Match|Read|Select|Look|Answer)\s+"
        r"(?:the|each|whether|YES|NO|TRUE|FALSE)",
        re.I,
    ),
]
_GLUE_MARKER = re.compile(r"(?:^|\s)\d{1,2}\s+[A-Z][a-z]")
_CLOZE_MARKER = re.compile(r"\(\d+\)")


def _is_garbage_question_text(text: str) -> tuple[bool, str]:
    """Return (is_garbage, reason)."""
    t = (text or "").strip()
    if len(t) < 3:
        return True, "empty_text"
    if _PLACEHOLDER_PATTERN.match(t):
        return True, "placeholder"
    for p in _HEADER_PATTERNS:
        if p.match(t):
            return True, "header"
    if len(t) < 200:
        for p in _INSTRUCTION_PATTERNS:
            if p.match(t):
                return True, "instruction"
    # Too many cloze markers in one row → 4+ blanks crammed in
    if len(_CLOZE_MARKER.findall(t)) >= 4:
        return True, "multi_blank_table"
    # Multiple glued questions: 2+ standalone "NN Capitalised" markers
    if len(_GLUE_MARKER.findall(" " + t)) >= 2:
        return True, "multi_glued"
    return False, ""


# ─── Per-test validation ────────────────────────────────────────────────────

@dataclass
class ValidationIssue:
    severity: str   # 'reject' | 'warn'
    where: str      # location identifier
    reason: str
    detail: str


@dataclass
class ValidationReport:
    issues: list[ValidationIssue]
    rejected: bool

    @property
    def rejections(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "reject"]


# Thresholds — anything below these and we reject the whole test.
MIN_PASSAGE_CHARS = 800       # real IELTS passages are ~700-900 words = ~4-6k chars
MIN_QUESTIONS = 8             # mini-ielts tests have ~13; tolerate some loss
MIN_ANSWER_COVERAGE = 0.85    # at least 85% of questions must have a parsed answer


def validate_test(
    test: MIReadingTest,
    answers: dict[int, str],
) -> ValidationReport:
    """Full validation: structure + per-question + answer coverage."""
    issues: list[ValidationIssue] = []

    # 1. Title + passage
    if not test.title.strip():
        issues.append(ValidationIssue("reject", "test", "no_title", ""))
    if len(test.passage_text) < MIN_PASSAGE_CHARS:
        issues.append(ValidationIssue(
            "reject", "passage",
            "passage_too_short",
            f"only {len(test.passage_text)} chars (min {MIN_PASSAGE_CHARS})",
        ))

    # 2. Question count
    if test.total_questions < MIN_QUESTIONS:
        issues.append(ValidationIssue(
            "reject", "test",
            "too_few_questions",
            f"only {test.total_questions} (min {MIN_QUESTIONS})",
        ))

    # 3. Per-question quality
    for g in test.groups:
        for q in g.questions:
            bad, reason = _is_garbage_question_text(q.question_text)
            if bad:
                issues.append(ValidationIssue(
                    "reject", f"q{q.qid}",
                    reason,
                    q.question_text[:80],
                ))
            # Options sanity: MCQ-kinds must have at least 2 options
            if q.kind in ("mcq",) and (not q.options or len(q.options) < 2):
                issues.append(ValidationIssue(
                    "warn", f"q{q.qid}",
                    "mcq_missing_options",
                    f"got {len(q.options or [])} options",
                ))

    # 4. Answer coverage
    qids_in_test = {q.qid for g in test.groups for q in g.questions}
    qids_with_answer = qids_in_test & set(answers.keys())
    coverage = len(qids_with_answer) / len(qids_in_test) if qids_in_test else 0
    if coverage < MIN_ANSWER_COVERAGE:
        issues.append(ValidationIssue(
            "reject", "answers",
            "low_answer_coverage",
            f"{coverage:.0%} (min {MIN_ANSWER_COVERAGE:.0%})",
        ))

    # Reject if ANY issue is severity=reject
    rejected = any(i.severity == "reject" for i in issues)
    return ValidationReport(issues=issues, rejected=rejected)


def merge_answers(test: MIReadingTest, answers: dict[int, str]) -> Iterable[tuple[MIQuestion, str | None]]:
    """Yield (question, answer_or_None) pairs in qid order."""
    for g in test.groups:
        for q in g.questions:
            yield q, answers.get(q.qid)
