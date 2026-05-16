#!/usr/bin/env python3
"""Normalize IELTS-UP Listening, Writing, and Speaking source files.

The input JSON files in data/ are immutable scrape artifacts. This script
creates the site/import layer on top of them:

  data/listening/sections.json
  data/listening/tests.json
  data/listening/manifest.json

  data/writing/tasks.json
  data/writing/tests.json
  data/writing/manifest.json

  data/speaking/parts.json
  data/speaking/tests.json
  data/speaking/manifest.json

  data/ielts_tests/manifest.json
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

LISTENING_SOURCE = DATA_DIR / "ielts_up_listening.json"
WRITING_SOURCE = DATA_DIR / "ielts_up_writing.json"
SPEAKING_SOURCE = DATA_DIR / "ielts_up_speaking.json"
READING_MANIFEST = DATA_DIR / "reading" / "manifest.json"

LISTENING_DURATION_SECONDS = 40 * 60
WRITING_DURATION_SECONDS = 60 * 60
SPEAKING_DURATION_SECONDS = 14 * 60


def repair_mojibake(value: Any) -> str:
    """Repair common UTF-8-as-Latin-1 mojibake from scraped IELTS-UP text."""
    if value is None:
        return ""
    text = str(value)
    try:
        repaired = text.encode("latin1").decode("utf-8")
        if repaired.count("\ufffd") <= text.count("\ufffd"):
            text = repaired
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    return text.replace("Ð¡", "C")


def clean_inline(value: Any) -> str:
    text = repair_mojibake(value)
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_multiline(value: Any) -> str:
    text = repair_mojibake(value).replace("\u00a0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines)


def clean_listening_instruction(value: Any) -> str:
    """Remove scraper duplication from IELTS-UP Listening prompt text.

    The source HTML often repeats the same block as page text, container text,
    table text, and individual cell text. Keep a readable section prompt:
    headings, rubric, and the most specific question/form lines.
    """
    raw_lines = clean_multiline(value).splitlines()
    deduped: list[str] = []
    seen: set[str] = set()
    for line in raw_lines:
        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(line)

    # Drop giant summary blobs when detailed lines are available below.
    has_detailed_lines = len(deduped) >= 8
    compact: list[str] = []
    for line in deduped:
        question_markers = len(re.findall(r"\b\d{1,2}\.\s*\.", line))
        if has_detailed_lines and len(line) > 220 and question_markers >= 3:
            continue
        compact.append(line)

    # Drop fragments fully contained in a richer nearby line. IELTS-UP often
    # emits answer options once inside the question row and then again as a
    # separate text node; keeping both makes the prompt look broken.
    out: list[str] = []
    for i, line in enumerate(compact):
        lower = line.lower()
        if (
            lower.startswith("section")
            and "questions" not in lower
            and any(
                j != i
                and other.lower().startswith(lower)
                and "questions" in other.lower()
                for j, other in enumerate(compact)
            )
        ):
            continue
        if (
            lower.startswith("section")
            and len(line) < 80
            and any(
                j != i
                and len(other) > len(line)
                and other.lower().startswith(lower)
                for j, other in enumerate(compact)
            )
        ):
            continue
        if not lower.startswith("section"):
            contained = False
            for j, other in enumerate(compact):
                if i == j or len(other) <= len(line):
                    continue
                if lower in other.lower():
                    contained = True
                    break
            if contained:
                continue
        out.append(line)

    # Keep the prompt readable. If a page still produced too much detail, keep
    # the first structurally useful lines rather than flooding every test.
    return "\n".join(out[:28])


def strip_answer_cta(value: str) -> str:
    return re.sub(r"\s*Answer\s*>\s*$", "", value, flags=re.I).strip()


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def answer_variants(answer: str) -> list[str]:
    parts = [clean_inline(part) for part in re.split(r"\s*/\s*", answer) if clean_inline(part)]
    return parts or [answer]


def normalize_listening_section(item: dict[str, Any]) -> dict[str, Any]:
    test_num = int(item.get("test_num") or 0)
    section_number = int(item.get("section") or 0)
    answers = [clean_inline(a) for a in item.get("answers") or [] if clean_inline(a)]
    question_start = ((section_number - 1) * 10 + 1) if 1 <= section_number <= 4 else 1

    questions = []
    for index, answer in enumerate(answers, start=1):
        global_number = question_start + index - 1
        variants = answer_variants(answer)
        questions.append(
            {
                "id": f"ieltsup_l_{test_num}_s{section_number}_q{global_number}",
                "number": global_number,
                "section_question_number": index,
                "type": "text",
                "text": f"Question {global_number}",
                "answer": variants[0],
                "answer_variants": variants,
            }
        )

    is_official_section = (
        test_num > 0
        and 1 <= section_number <= 4
        and len(questions) == 10
        and bool(clean_inline(item.get("mp3_absolute_url")))
    )

    return {
        "id": f"ieltsup_l_{test_num}_s{section_number}",
        "source": "ielts_up",
        "source_test_num": test_num,
        "section_number": section_number,
        "title": clean_inline(item.get("title")) or f"Listening Test {test_num} Section {section_number}",
        "audio_url": clean_inline(item.get("mp3_absolute_url")) or None,
        "audio_filename": clean_inline(item.get("mp3_filename")) or None,
        "instruction": clean_listening_instruction(item.get("instruction")),
        "question_count": len(questions),
        "has_complete_answers": len(questions) == 10,
        "is_official_section": is_official_section,
        "questions": questions,
        "source_url": clean_inline(item.get("url")) or None,
    }


def build_listening(raw_items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    sections = [normalize_listening_section(item) for item in raw_items]
    by_test: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for section in sections:
        by_test[section["source_test_num"]].append(section)

    tests = []
    for test_num in sorted(n for n in by_test if n > 0):
        section_map = {s["section_number"]: s for s in by_test[test_num]}
        if not all(n in section_map and section_map[n]["is_official_section"] for n in range(1, 5)):
            continue
        selected = [section_map[n] for n in range(1, 5)]
        tests.append(
            {
                "id": f"listening_test_{len(tests) + 1:03d}",
                "title": f"IELTS Listening Test {test_num}",
                "source": "ielts_up",
                "source_test_num": test_num,
                "duration_seconds": LISTENING_DURATION_SECONDS,
                "total_questions": sum(s["question_count"] for s in selected),
                "quality": "official_4_sections_40_questions",
                "sections": [
                    {
                        "section_number": s["section_number"],
                        "section_id": s["id"],
                        "title": s["title"],
                        "question_count": s["question_count"],
                        "audio_url": s["audio_url"],
                    }
                    for s in selected
                ],
            }
        )

    section_distribution = Counter(s["section_number"] for s in sections)
    answer_distribution = Counter(s["question_count"] for s in sections)
    manifest = {
        "source_file": "data/ielts_up_listening.json",
        "source_is_immutable": True,
        "outputs": {
            "sections": "data/listening/sections.json",
            "tests": "data/listening/tests.json",
        },
        "ielts_format": {
            "sections_per_test": 4,
            "questions_per_section": 10,
            "official_total_questions": 40,
            "duration_seconds": LISTENING_DURATION_SECONDS,
        },
        "stats": {
            "section_count": len(sections),
            "official_section_count": sum(1 for s in sections if s["is_official_section"]),
            "test_count": len(tests),
            "section_distribution": dict(sorted(section_distribution.items())),
            "question_count_distribution": dict(sorted(answer_distribution.items())),
        },
        "known_issues": {
            "incomplete_source_test_nums": [
                test_num
                for test_num in sorted(n for n in by_test if n > 0)
                if test_num not in {t["source_test_num"] for t in tests}
            ],
            "notes": [
                "Each source row is one Listening section with 10 answers.",
                "Only source tests containing sections 1, 2, 3, and 4 are promoted to official Listening tests.",
            ],
        },
    }
    return sections, tests, manifest


def normalize_writing_task(item: dict[str, Any]) -> dict[str, Any]:
    task_type = clean_inline(item.get("task_type")) or "task2"
    min_words = int(item.get("min_words") or (250 if task_type == "task2" else 150))
    source_id = clean_inline(item.get("external_id")) or f"ieltsup_w_{len(clean_inline(item.get('prompt_text')))}"
    return {
        "id": source_id,
        "source": "ielts_up",
        "topic_slug": clean_inline(item.get("topic_slug")),
        "prompt_index": int(item.get("prompt_index") or 0),
        "task_type": task_type,
        "exam_type": clean_inline(item.get("exam_type")) or "academic",
        "min_words": min_words,
        "duration_seconds": 40 * 60 if task_type == "task2" else 20 * 60,
        "prompt_text": strip_answer_cta(clean_multiline(item.get("prompt_text"))),
    }


def build_writing(raw_items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    tasks = [normalize_writing_task(item) for item in raw_items]
    task1 = [t for t in tasks if t["task_type"] == "task1"]
    task2 = [t for t in tasks if t["task_type"] == "task2"]

    tests = []
    official_count = min(len(task1), len(task2))
    for i in range(official_count):
        tests.append(
            {
                "id": f"writing_test_{len(tests) + 1:03d}",
                "title": f"IELTS Academic Writing Test {len(tests) + 1}",
                "source": "ielts_up",
                "exam_type": "academic",
                "duration_seconds": WRITING_DURATION_SECONDS,
                "quality": "official_task1_task2",
                "tasks": [
                    {"task_number": 1, "task_id": task1[i]["id"], "min_words": task1[i]["min_words"]},
                    {"task_number": 2, "task_id": task2[i]["id"], "min_words": task2[i]["min_words"]},
                ],
            }
        )

    for task in task2[official_count:]:
        tests.append(
            {
                "id": f"writing_test_{len(tests) + 1:03d}",
                "title": f"Writing Task 2 Practice {len(tests) + 1 - official_count}",
                "source": "ielts_up",
                "exam_type": task["exam_type"],
                "duration_seconds": task["duration_seconds"],
                "quality": "task2_only_practice",
                "tasks": [
                    {"task_number": 2, "task_id": task["id"], "min_words": task["min_words"]},
                ],
            }
        )

    manifest = {
        "source_file": "data/ielts_up_writing.json",
        "source_is_immutable": True,
        "outputs": {
            "tasks": "data/writing/tasks.json",
            "tests": "data/writing/tests.json",
        },
        "ielts_format": {
            "tasks_per_test": 2,
            "task1_min_words": 150,
            "task2_min_words": 250,
            "duration_seconds": WRITING_DURATION_SECONDS,
        },
        "stats": {
            "task_count": len(tasks),
            "task_type_counts": dict(sorted(Counter(t["task_type"] for t in tasks).items())),
            "official_writing_test_count": official_count,
            "site_test_count": len(tests),
            "site_test_quality_counts": dict(sorted(Counter(t["quality"] for t in tests).items())),
        },
        "known_issues": {
            "missing_task1_count": max(0, len(task2) - len(task1)),
            "notes": [
                "IELTS-UP writing source currently contains Task 2 prompts only.",
                "No official IELTS Writing test can be assembled until Task 1 prompts are added.",
            ],
        },
    }
    return tasks, tests, manifest


def normalize_speaking_part(item: dict[str, Any]) -> dict[str, Any]:
    part = int(item.get("part") or 0)
    topic_slug = clean_inline(item.get("topic_slug"))
    questions = [clean_inline(q) for q in item.get("questions") or [] if clean_inline(q)]
    cue_card_points = [clean_inline(q) for q in item.get("cue_card_points") or [] if clean_inline(q)]
    source_id = clean_inline(item.get("external_id")) or f"ieltsup_s_{topic_slug}_p{part}"
    return {
        "id": source_id,
        "source": "ielts_up",
        "part": part,
        "topic_slug": topic_slug,
        "topic_title": clean_inline(item.get("topic_title")),
        "topic_text": clean_multiline(item.get("topic_text")),
        "questions": questions,
        "cue_card_points": cue_card_points,
        "sample_answer": clean_multiline(item.get("sample_answer")) or None,
        "source_url": clean_inline(item.get("source_url")) or None,
    }


def speaking_test_quality(parts: list[dict[str, Any]]) -> str:
    part_map = {p["part"]: p for p in parts}
    p1_ok = len(part_map[1]["questions"]) > 0
    p2_ok = bool(part_map[2]["topic_text"])
    p2_points_ok = len(part_map[2]["cue_card_points"]) >= 3
    p3_ok = len(part_map[3]["questions"]) > 0
    if p1_ok and p2_ok and p2_points_ok and p3_ok:
        return "official_parts_with_cue_card"
    if p1_ok and p2_ok and p3_ok:
        return "official_parts_missing_cue_points"
    return "incomplete"


def build_speaking(raw_items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    parts = [normalize_speaking_part(item) for item in raw_items]
    by_topic: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for part in parts:
        by_topic[part["topic_slug"]].append(part)

    tests = []
    for topic_slug in sorted(by_topic):
        part_map = {p["part"]: p for p in by_topic[topic_slug]}
        if not all(n in part_map for n in (1, 2, 3)):
            continue
        selected = [part_map[1], part_map[2], part_map[3]]
        quality = speaking_test_quality(selected)
        if quality == "incomplete":
            continue
        title = selected[0]["topic_title"] or f"Speaking Topic {topic_slug}"
        tests.append(
            {
                "id": f"speaking_test_{len(tests) + 1:03d}",
                "title": f"IELTS Speaking Test {len(tests) + 1}: {title}",
                "source": "ielts_up",
                "topic_slug": topic_slug,
                "topic_title": title,
                "duration_seconds": SPEAKING_DURATION_SECONDS,
                "quality": quality,
                "parts": [
                    {
                        "part_number": p["part"],
                        "part_id": p["id"],
                        "question_count": len(p["questions"]),
                        "cue_card_point_count": len(p["cue_card_points"]),
                    }
                    for p in selected
                ],
            }
        )

    manifest = {
        "source_file": "data/ielts_up_speaking.json",
        "source_is_immutable": True,
        "outputs": {
            "parts": "data/speaking/parts.json",
            "tests": "data/speaking/tests.json",
        },
        "ielts_format": {
            "parts_per_test": 3,
            "duration_seconds": SPEAKING_DURATION_SECONDS,
        },
        "stats": {
            "part_count": len(parts),
            "part_distribution": dict(sorted(Counter(p["part"] for p in parts).items())),
            "test_count": len(tests),
            "test_quality_counts": dict(sorted(Counter(t["quality"] for t in tests).items())),
        },
        "known_issues": {
            "part2_without_cue_points": [
                p["id"]
                for p in parts
                if p["part"] == 2 and len(p["cue_card_points"]) < 3
            ],
            "notes": [
                "All promoted Speaking tests contain Parts 1, 2, and 3.",
                "Some Part 2 rows have a prompt but no extracted cue-card bullet points.",
            ],
        },
    }
    return parts, tests, manifest


def build_overall_manifest(
    listening_manifest: dict[str, Any],
    writing_manifest: dict[str, Any],
    speaking_manifest: dict[str, Any],
) -> dict[str, Any]:
    reading_stats = {}
    if READING_MANIFEST.exists():
        reading_stats = load_json(READING_MANIFEST).get("stats", {})

    reading_official = int(reading_stats.get("official_40_question_mock_count") or 0)
    listening_official = int(listening_manifest["stats"]["test_count"])
    writing_official = int(writing_manifest["stats"]["official_writing_test_count"])
    speaking_with_parts = int(speaking_manifest["stats"]["test_count"])
    speaking_with_full_cue = int(
        speaking_manifest["stats"]["test_quality_counts"].get("official_parts_with_cue_card", 0)
    )

    return {
        "source_is_immutable": True,
        "skill_test_counts": {
            "reading_official_40_question": reading_official,
            "listening_official_4_sections": listening_official,
            "writing_official_task1_task2": writing_official,
            "speaking_parts_1_2_3": speaking_with_parts,
            "speaking_parts_1_2_3_with_cue_points": speaking_with_full_cue,
        },
        "full_ielts_test_count": min(
            reading_official,
            listening_official,
            writing_official,
            speaking_with_full_cue,
        ),
        "full_ielts_blockers": [
            "Writing Task 1 source data is missing, so full IELTS tests across all four skills cannot be assembled yet."
        ]
        if writing_official == 0
        else [],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args()

    listening_raw = load_json(args.data_dir / "ielts_up_listening.json")
    writing_raw = load_json(args.data_dir / "ielts_up_writing.json")
    speaking_raw = load_json(args.data_dir / "ielts_up_speaking.json")

    listening_sections, listening_tests, listening_manifest = build_listening(listening_raw)
    writing_tasks, writing_tests, writing_manifest = build_writing(writing_raw)
    speaking_parts, speaking_tests, speaking_manifest = build_speaking(speaking_raw)
    overall_manifest = build_overall_manifest(listening_manifest, writing_manifest, speaking_manifest)

    write_json(args.data_dir / "listening" / "sections.json", listening_sections)
    write_json(args.data_dir / "listening" / "tests.json", listening_tests)
    write_json(args.data_dir / "listening" / "manifest.json", listening_manifest)

    write_json(args.data_dir / "writing" / "tasks.json", writing_tasks)
    write_json(args.data_dir / "writing" / "tests.json", writing_tests)
    write_json(args.data_dir / "writing" / "manifest.json", writing_manifest)

    write_json(args.data_dir / "speaking" / "parts.json", speaking_parts)
    write_json(args.data_dir / "speaking" / "tests.json", speaking_tests)
    write_json(args.data_dir / "speaking" / "manifest.json", speaking_manifest)

    write_json(args.data_dir / "ielts_tests" / "manifest.json", overall_manifest)

    print(json.dumps(
        {
            "listening": listening_manifest["stats"],
            "writing": writing_manifest["stats"],
            "speaking": speaking_manifest["stats"],
            "overall": overall_manifest,
        },
        ensure_ascii=False,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
