#!/usr/bin/env python3
"""Normalize Mini IELTS Reading source data without mutating the source file.

Input:
  data/mini_ielts_reading.json

Outputs:
  data/reading/passages.json
  data/reading/tests.json
  data/reading/mocks.json
  data/reading/manifest.json

The source file is treated as the immutable scrape artifact. This script builds
the stable application/import layer on top of it.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "data" / "mini_ielts_reading.json"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "reading"

READING_DURATION_SECONDS = 60 * 60
SOURCE_NAME = "mini_ielts"


def clean_inline(value: Any) -> str:
    """Collapse whitespace for UI labels, instructions, and question stems."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def clean_passage(value: Any) -> str:
    """Preserve paragraph breaks while normalizing whitespace inside lines."""
    if value is None:
        return ""
    paragraphs = []
    for part in re.split(r"\n\s*\n", str(value)):
        text = clean_inline(part)
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs)


def stable_slug(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "untitled"


def normalize_answer(raw: Any) -> str | None:
    if raw is None:
        return None
    answer = clean_inline(raw)
    if not answer:
        return None
    upper = answer.upper()
    if re.fullmatch(r"[A-J]", upper):
        return upper
    if upper in {"TRUE", "FALSE", "YES", "NO", "NOT GIVEN"}:
        return upper
    return answer


def answer_kind(answer: str | None) -> str:
    if answer is None:
        return "missing"
    if re.fullmatch(r"[A-J]", answer):
        return "letter"
    if answer in {"TRUE", "FALSE", "YES", "NO", "NOT GIVEN"}:
        return "boolean_not_given"
    return "text"


def normalize_group_type(raw_type: Any, instruction: str, answers: list[str | None]) -> str:
    source_type = clean_inline(raw_type).lower() or "unknown"
    inst = instruction.upper()
    answer_set = {a for a in answers if a}
    if {"YES", "NO"} & answer_set or ("YES" in inst and "NO" in inst and "NOT GIVEN" in inst):
        return "ynng"
    if {"TRUE", "FALSE"} & answer_set or ("TRUE" in inst and "FALSE" in inst and "NOT GIVEN" in inst):
        return "tfng"
    if source_type in {"mcq", "matching", "completion", "short_answer"}:
        return source_type
    return source_type


def normalize_options(group_type: str, raw_options: Any) -> list[str] | None:
    if group_type == "tfng":
        return ["TRUE", "FALSE", "NOT GIVEN"]
    if group_type == "ynng":
        return ["YES", "NO", "NOT GIVEN"]
    if not isinstance(raw_options, list):
        return None
    options = [clean_inline(o) for o in raw_options if clean_inline(o)]
    return options or None


def normalize_passage(item: dict[str, Any], source_index: int) -> dict[str, Any]:
    source_test_id = clean_inline(item.get("test_id")) or str(source_index + 1)
    slug = stable_slug(clean_inline(item.get("slug")) or clean_inline(item.get("title")))
    passage_id = f"{SOURCE_NAME}_reading_{source_test_id}"
    answers = item.get("answers") if isinstance(item.get("answers"), dict) else {}

    groups: list[dict[str, Any]] = []
    flat_questions: list[dict[str, Any]] = []
    type_counts: Counter[str] = Counter()
    missing_answers = 0

    for group_index, raw_group in enumerate(item.get("groups") or [], start=1):
        raw_questions = raw_group.get("questions") or []
        group_answers = [
            normalize_answer(answers.get(str(q.get("qid"))))
            for q in raw_questions
            if isinstance(q, dict)
        ]
        instruction = clean_inline(raw_group.get("instruction"))
        group_type = normalize_group_type(raw_group.get("question_type"), instruction, group_answers)

        questions: list[dict[str, Any]] = []
        for question_index, raw_question in enumerate(raw_questions, start=1):
            if not isinstance(raw_question, dict):
                continue
            qid = int(raw_question.get("qid") or question_index)
            answer = normalize_answer(answers.get(str(qid)))
            if answer is None:
                missing_answers += 1

            question_type = group_type
            options = normalize_options(question_type, raw_question.get("options"))
            if question_type in {"completion", "short_answer"}:
                options = None

            question = {
                "id": f"{passage_id}_q{qid}",
                "number": qid,
                "type": question_type,
                "text": clean_inline(raw_question.get("question_text")),
                "options": options,
                "answer": answer,
                "answer_kind": answer_kind(answer),
            }
            questions.append(question)
            flat_questions.append(question)
            type_counts[question_type] += 1

        if not questions:
            continue

        numbers = [q["number"] for q in questions]
        groups.append(
            {
                "id": f"{passage_id}_g{group_index}",
                "range": {
                    "start": min(numbers),
                    "end": max(numbers),
                    "label": clean_inline(raw_group.get("range_label")),
                },
                "type": group_type,
                "instruction": instruction,
                "questions": questions,
            }
        )

    question_count = len(flat_questions)
    answer_count = question_count - missing_answers
    answer_coverage = round(answer_count / question_count, 4) if question_count else 0.0

    return {
        "id": passage_id,
        "source": SOURCE_NAME,
        "source_test_id": source_test_id,
        "source_index": source_index,
        "slug": slug,
        "title": clean_inline(item.get("title")) or "Untitled Reading Passage",
        "exam_type": "academic",
        "passage_text": clean_passage(item.get("passage_text")),
        "question_count": question_count,
        "answer_count": answer_count,
        "answer_coverage": answer_coverage,
        "has_complete_answers": missing_answers == 0,
        "question_type_counts": dict(sorted(type_counts.items())),
        "groups": groups,
        "source_url": clean_inline(item.get("url")) or None,
        "solution_url": clean_inline(item.get("solution_url")) or None,
    }


def bucket_by_question_count(passages: list[dict[str, Any]]) -> dict[int, deque[dict[str, Any]]]:
    buckets: dict[int, deque[dict[str, Any]]] = defaultdict(deque)
    for passage in passages:
        if passage["has_complete_answers"] and 12 <= passage["question_count"] <= 14:
            buckets[passage["question_count"]].append(passage)
    return buckets


def pop_passage(buckets: dict[int, deque[dict[str, Any]]], question_count: int) -> dict[str, Any] | None:
    bucket = buckets.get(question_count)
    if not bucket:
        return None
    return bucket.popleft()


def build_mock(mock_number: int, selected: list[dict[str, Any]], quality: str) -> dict[str, Any]:
    total_questions = sum(p["question_count"] for p in selected)
    passages = []
    for part_number, passage in enumerate(selected, start=1):
        passages.append(
            {
                "part_number": part_number,
                "passage_id": passage["id"],
                "title": passage["title"],
                "question_count": passage["question_count"],
            }
        )
    return {
        "id": f"reading_mock_{mock_number:03d}",
        "title": f"IELTS Academic Reading Mock {mock_number}",
        "exam_type": "academic",
        "duration_seconds": READING_DURATION_SECONDS,
        "total_questions": total_questions,
        "quality": quality,
        "passages": passages,
    }


def build_mocks(passages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build deterministic 3-passage Reading mocks.

    Exact mocks use 13+13+14 = 40 questions. Additional near-official mocks use
    13+13+13 = 39 questions and are marked separately so the app can decide
    whether to show them as full mocks or practice mocks.
    """
    buckets = bucket_by_question_count(passages)
    mocks: list[dict[str, Any]] = []
    mock_number = 1

    while len(buckets[13]) >= 2 and len(buckets[14]) >= 1:
        selected = [
            pop_passage(buckets, 13),
            pop_passage(buckets, 13),
            pop_passage(buckets, 14),
        ]
        if any(p is None for p in selected):
            break
        mocks.append(build_mock(mock_number, selected, "official_40_questions"))  # type: ignore[arg-type]
        mock_number += 1

    while len(buckets[13]) >= 3:
        selected = [
            pop_passage(buckets, 13),
            pop_passage(buckets, 13),
            pop_passage(buckets, 13),
        ]
        if any(p is None for p in selected):
            break
        mocks.append(build_mock(mock_number, selected, "near_official_39_questions"))  # type: ignore[arg-type]
        mock_number += 1

    return mocks


def test_quality(total_questions: int) -> str:
    if total_questions == 40:
        return "official_40_questions"
    if 36 <= total_questions <= 42:
        return "near_official_question_count"
    return "practice_short_question_count"


def build_site_test(test_number: int, selected: list[dict[str, Any]]) -> dict[str, Any]:
    total_questions = sum(p["question_count"] for p in selected)
    passages = []
    for part_number, passage in enumerate(selected, start=1):
        passages.append(
            {
                "part_number": part_number,
                "passage_id": passage["id"],
                "title": passage["title"],
                "question_count": passage["question_count"],
            }
        )

    return {
        "id": f"reading_test_{test_number:03d}",
        "title": f"Reading Test {test_number}",
        "exam_type": "academic",
        "duration_seconds": READING_DURATION_SECONDS,
        "total_questions": total_questions,
        "quality": test_quality(total_questions),
        "passages": passages,
    }


def build_site_tests(passages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Build every possible 3-passage site test from complete-answer passages.

    First we reserve the best IELTS-like combinations:
    - 13 + 13 + 14 = 40 questions
    - 13 + 13 + 13 = 39 questions

    Then the remaining complete passages are grouped in source order. This uses
    the whole available bank exactly once, except for the final 1-2 leftovers
    that cannot form a 3-passage test.
    """
    buckets = bucket_by_question_count(passages)
    used_ids: set[str] = set()
    tests: list[dict[str, Any]] = []
    test_number = 1

    def take(question_count: int) -> dict[str, Any] | None:
        passage = pop_passage(buckets, question_count)
        if passage is not None:
            used_ids.add(passage["id"])
        return passage

    while len(buckets[13]) >= 2 and len(buckets[14]) >= 1:
        selected = [take(13), take(13), take(14)]
        if any(p is None for p in selected):
            break
        tests.append(build_site_test(test_number, selected))  # type: ignore[arg-type]
        test_number += 1

    while len(buckets[13]) >= 3:
        selected = [take(13), take(13), take(13)]
        if any(p is None for p in selected):
            break
        tests.append(build_site_test(test_number, selected))  # type: ignore[arg-type]
        test_number += 1

    remaining = [
        p
        for p in passages
        if p["has_complete_answers"] and p["id"] not in used_ids
    ]

    leftovers: list[dict[str, Any]] = []
    for i in range(0, len(remaining), 3):
        chunk = remaining[i:i + 3]
        if len(chunk) < 3:
            leftovers.extend(chunk)
            break
        tests.append(build_site_test(test_number, chunk))
        test_number += 1

    return tests, leftovers


def build_manifest(
    passages: list[dict[str, Any]],
    tests: list[dict[str, Any]],
    mocks: list[dict[str, Any]],
    site_test_leftovers: list[dict[str, Any]],
) -> dict[str, Any]:
    q_count_distribution = Counter(p["question_count"] for p in passages)
    type_counts: Counter[str] = Counter()
    missing_answer_passages = []
    for passage in passages:
        type_counts.update(passage["question_type_counts"])
        if not passage["has_complete_answers"]:
            missing_answer_passages.append(
                {
                    "id": passage["id"],
                    "title": passage["title"],
                    "missing_answers": passage["question_count"] - passage["answer_count"],
                }
            )

    return {
        "source_file": "data/mini_ielts_reading.json",
        "source_is_immutable": True,
        "outputs": {
            "passages": "data/reading/passages.json",
            "tests": "data/reading/tests.json",
            "mocks": "data/reading/mocks.json",
        },
        "reading_format": {
            "mock_passages": 3,
            "official_total_questions": 40,
            "duration_seconds": READING_DURATION_SECONDS,
        },
        "stats": {
            "passage_count": len(passages),
            "question_count": sum(p["question_count"] for p in passages),
            "complete_answer_passage_count": sum(1 for p in passages if p["has_complete_answers"]),
            "question_count_distribution": dict(sorted(q_count_distribution.items())),
            "question_type_counts": dict(sorted(type_counts.items())),
            "site_test_count": len(tests),
            "site_test_quality_counts": dict(sorted(Counter(t["quality"] for t in tests).items())),
            "site_test_leftover_passage_count": len(site_test_leftovers),
            "mock_count": len(mocks),
            "official_40_question_mock_count": sum(
                1 for mock in mocks if mock["quality"] == "official_40_questions"
            ),
            "near_official_39_question_mock_count": sum(
                1 for mock in mocks if mock["quality"] == "near_official_39_questions"
            ),
        },
        "known_issues": {
            "passages_with_missing_answers": missing_answer_passages,
            "site_test_leftover_passages": [
                {
                    "id": p["id"],
                    "title": p["title"],
                    "question_count": p["question_count"],
                }
                for p in site_test_leftovers
            ],
            "notes": [
                "Mini IELTS source entries are single-passage practice tests, not complete IELTS exams.",
                "Generated site tests combine all complete-answer passages into three-passage Reading tests.",
                "Generated mocks are the stricter IELTS-like subset.",
                "Question types ynng, completion, and matching need explicit UI/import support before full production use.",
            ],
        },
    }


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    raw = json.loads(args.source.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"Expected a list in {args.source}")

    passages = [normalize_passage(item, i) for i, item in enumerate(raw) if isinstance(item, dict)]
    tests, site_test_leftovers = build_site_tests(passages)
    mocks = build_mocks(passages)
    manifest = build_manifest(passages, tests, mocks, site_test_leftovers)

    write_json(args.output_dir / "passages.json", passages)
    write_json(args.output_dir / "tests.json", tests)
    write_json(args.output_dir / "mocks.json", mocks)
    write_json(args.output_dir / "manifest.json", manifest)

    print(json.dumps(manifest["stats"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
