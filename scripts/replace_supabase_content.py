#!/usr/bin/env python3
"""Replace Supabase IELTS content with normalized clean data.

This script intentionally touches only content tables and user_content_seen.
It does not delete profiles, subscriptions, attempts, diagnostics, or tutor
messages.

Run backup first:
  python3 scripts/backup_supabase_content.py
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BACKUP_ROOT = DATA / "supabase_backups"
ZERO_UUID = "00000000-0000-0000-0000-000000000000"


def client():
    load_dotenv(ROOT / ".env.local")
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Missing Supabase env")
    return create_client(url, key)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def source_id(value: str, prefix: str) -> str:
    value = clean_text(value)
    return value if value.startswith(prefix) else f"{prefix}_{value}"


def fetch_all(sb: Any, table: str, page_size: int = 1000) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        res = sb.table(table).select("*").range(start, start + page_size - 1).execute()
        chunk = res.data or []
        rows.extend(chunk)
        if len(chunk) < page_size:
            return rows
        start += page_size


def latest_backup_table(table: str) -> list[dict[str, Any]]:
    if not BACKUP_ROOT.exists():
        return []
    backups = sorted([p for p in BACKUP_ROOT.iterdir() if p.is_dir()], reverse=True)
    for backup in backups:
        path = backup / f"{table}.json"
        if path.exists():
            return load_json(path)
    return []


def valid_existing_writing_tasks(sb: Any) -> list[dict[str, Any]]:
    """Keep valid existing Task 1/Task 2 rows so DB-only Task 1 is not lost."""
    rows = fetch_all(sb, "writing_tasks")
    if not rows:
        rows = latest_backup_table("writing_tasks")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        task_type = row.get("task_type")
        prompt = clean_text(row.get("prompt_text"))
        if task_type not in {"task1", "task2"} or len(prompt) < 30:
            continue
        external_id = clean_text(row.get("external_id")) or f"db_writing_{row.get('id')}"
        if external_id in seen:
            continue
        seen.add(external_id)
        out.append({
            "source": row.get("source") or "supabase_cleaned",
            "task_type": task_type,
            "exam_type": row.get("exam_type") or "academic",
            "prompt_text": row.get("prompt_text"),
            "image_url": row.get("image_url"),
            "sample_answer": row.get("sample_answer"),
            "min_words": row.get("min_words") or (150 if task_type == "task1" else 250),
            "external_id": external_id,
        })
    return out


def delete_content(sb: Any) -> None:
    # Clear rotation state for content that is being replaced. Attempts are
    # intentionally preserved as historical user results.
    sb.table("user_content_seen").delete().in_("content_type", [
        "reading",
        "listening",
        "writing",
        "speaking",
    ]).execute()

    # Delete explicitly child -> parent in batches. Large cascading deletes can
    # hit Supabase statement_timeout on projects with thousands of imported
    # garbage rows.
    for table in [
        "reading_questions",
        "reading_question_groups",
        "reading_sections",
        "reading_tests",
        "listening_questions",
        "listening_question_groups",
        "listening_tests",
        "writing_tasks",
        "speaking_topics",
    ]:
        delete_all_rows_batched(sb, table)


def delete_all_rows_batched(sb: Any, table: str, batch_size: int = 100) -> int:
    deleted = 0
    while True:
        rows = sb.table(table).select("id").limit(batch_size).execute().data or []
        ids = [row["id"] for row in rows if row.get("id")]
        if not ids:
            return deleted
        sb.table(table).delete().in_("id", ids).execute()
        deleted += len(ids)
        print(f"deleted {deleted} from {table}", flush=True)


def insert_reading(sb: Any) -> int:
    passages = {p["id"]: p for p in load_json(DATA / "reading" / "passages.json")}
    tests = load_json(DATA / "reading" / "tests.json")

    inserted = 0
    for test in tests:
        res = sb.table("reading_tests").insert({
            "source": "normalized_mini_ielts",
            "category": test.get("exam_type") or "academic",
            "title": test["title"],
            "difficulty": None,
            "external_id": test["id"],
        }).execute()
        test_id = res.data[0]["id"]

        global_sort = 1
        for part in test["passages"]:
            passage = passages[part["passage_id"]]
            sec_res = sb.table("reading_sections").insert({
                "test_id": test_id,
                "part_number": part["part_number"],
                "passage_text": passage["passage_text"],
            }).execute()
            section_id = sec_res.data[0]["id"]

            for group_index, group in enumerate(passage["groups"], start=1):
                group_type = group["type"]
                db_group_type = "tfng" if group_type == "ynng" else group_type
                grp_res = sb.table("reading_question_groups").insert({
                    "section_id": section_id,
                    "instruction": group.get("instruction"),
                    "question_type": db_group_type,
                    "sort_order": group_index,
                }).execute()
                group_id = grp_res.data[0]["id"]

                rows = []
                for q in group["questions"]:
                    rows.append({
                        "group_id": group_id,
                        "question_text": q["text"],
                        "options": q.get("options"),
                        "correct_answer": q.get("answer") or "",
                        "explanation": None,
                        "sort_order": global_sort,
                    })
                    global_sort += 1
                if rows:
                    sb.table("reading_questions").insert(rows).execute()
        inserted += 1
    return inserted


def insert_listening(sb: Any) -> int:
    sections = {s["id"]: s for s in load_json(DATA / "listening" / "sections.json")}
    tests = load_json(DATA / "listening" / "tests.json")

    inserted = 0
    for test in tests:
        selected_sections = [sections[p["section_id"]] for p in test["sections"]]
        first_audio = selected_sections[0].get("audio_url")
        transcript_payload = {
            "section_audio_urls": {
                str(s["section_number"]): s.get("audio_url") for s in selected_sections
            }
        }
        res = sb.table("listening_tests").insert({
            "source": "normalized_ielts_up",
            "title": test["title"],
            "section": None,
            "audio_url": first_audio,
            "audio_duration": None,
            "transcript": json.dumps(transcript_payload, ensure_ascii=False),
            "external_id": test["id"],
        }).execute()
        test_id = res.data[0]["id"]

        sort_order = 1
        for section in selected_sections:
            group_row = {
                "test_id": test_id,
                "instruction": section.get("instruction"),
                "question_type": "completion",
                "sort_order": section["section_number"],
                "section_number": section["section_number"],
            }
            try:
                grp_res = sb.table("listening_question_groups").insert(group_row).execute()
            except Exception:
                group_row.pop("section_number", None)
                grp_res = sb.table("listening_question_groups").insert(group_row).execute()
            group_id = grp_res.data[0]["id"]

            rows = []
            for q in section["questions"]:
                rows.append({
                    "group_id": group_id,
                    "question_text": q["text"],
                    "options": None,
                    "correct_answer": q["answer"],
                    "sort_order": sort_order,
                })
                sort_order += 1
            if rows:
                sb.table("listening_questions").insert(rows).execute()
        inserted += 1
    return inserted


def insert_writing(sb: Any, existing_clean_tasks: list[dict[str, Any]]) -> int:
    local_tasks = load_json(DATA / "writing" / "tasks.json")
    by_external: dict[str, dict[str, Any]] = {}

    for row in existing_clean_tasks:
        by_external[row["external_id"]] = row

    for task in local_tasks:
        external_id = task["id"]
        by_external.setdefault(external_id, {
            "source": "normalized_ielts_up",
            "task_type": task["task_type"],
            "exam_type": task["exam_type"],
            "prompt_text": task["prompt_text"],
            "image_url": None,
            "sample_answer": None,
            "min_words": task["min_words"],
            "external_id": external_id,
        })

    rows = list(by_external.values())
    for i in range(0, len(rows), 200):
        sb.table("writing_tasks").insert(rows[i:i + 200]).execute()
    return len(rows)


def insert_speaking(sb: Any) -> int:
    parts = load_json(DATA / "speaking" / "parts.json")
    rows = []
    for part in parts:
        rows.append({
            "source": "normalized_ielts_up",
            "part": part["part"],
            "topic_text": part["topic_text"],
            "cue_card_points": part["cue_card_points"] or None,
            "follow_up_questions": part["questions"] or None,
            "sample_answer": part.get("sample_answer"),
            "band_range": None,
            "external_id": part["id"],
        })
    if rows:
        sb.table("speaking_topics").insert(rows).execute()
    return len(rows)


def verify_counts(sb: Any) -> dict[str, int]:
    out = {}
    for table in [
        "reading_tests",
        "reading_sections",
        "reading_question_groups",
        "reading_questions",
        "listening_tests",
        "listening_question_groups",
        "listening_questions",
        "writing_tasks",
        "speaking_topics",
    ]:
        res = sb.table(table).select("id", count="exact").limit(1).execute()
        out[table] = int(res.count or 0)
    return out


def main() -> int:
    sb = client()
    existing_writing = valid_existing_writing_tasks(sb)
    print(f"Preserving valid existing writing tasks: {len(existing_writing)}")

    delete_content(sb)
    print("Deleted old content tables")

    counts = {
        "reading_tests_inserted": insert_reading(sb),
        "listening_tests_inserted": insert_listening(sb),
        "writing_tasks_inserted": insert_writing(sb, existing_writing),
        "speaking_topics_inserted": insert_speaking(sb),
    }
    counts.update(verify_counts(sb))
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
