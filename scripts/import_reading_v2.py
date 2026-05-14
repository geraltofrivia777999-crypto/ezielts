#!/usr/bin/env python3
"""
EZielts — Clean Reading importer (v2).

Replaces the buggy logic in `import_to_supabase.py::import_reading()`.
Delegates ALL parsing to `scripts/parsers/reading_parser.py`, which is
pure / side-effect-free / exhaustively unit-tested.

Usage:
    pip install supabase python-dotenv tqdm
    python scripts/import_reading_v2.py [--dry-run] [--min-questions 20]
        [--source-json /path/to/practicepteonline_reading.json]
        [--limit 100]

Environment (.env.local):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJ...

The `--min-questions` flag is a SAFETY GUARD: only tests with at least N
parseable questions are imported. The source JSON is significantly
incomplete (most rows have only 1 of 3 passages); setting `--min-questions 20`
ensures we don't import broken stubs.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

# Import the pure parser (no DB)
sys.path.insert(0, str(Path(__file__).parent))
from parsers.reading_parser import (
    parse_reading_file,
    ParsedReadingTest,
    parsed_to_json,
)

load_dotenv(Path(__file__).parent.parent / ".env.local")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def write_test(sb: Client, test: ParsedReadingTest) -> int:
    """Insert one parsed test + its passages/groups/questions.
    Returns total questions inserted."""
    # 1. Upsert reading_tests row
    test_row = {
        "external_id": test.external_id,
        "source": "practicepteonline_v2",
        "category": test.category,
        "title": test.title,
        "difficulty": None,
    }
    res = sb.table("reading_tests").upsert(test_row, on_conflict="external_id").execute()
    test_id = res.data[0]["id"] if res.data else None
    if not test_id:
        # Already exists → fetch id
        res2 = sb.table("reading_tests").select("id").eq("external_id", test.external_id).single().execute()
        test_id = res2.data["id"]

    # 2. Delete any existing sections/groups/questions for this test (cascade)
    sb.table("reading_sections").delete().eq("test_id", test_id).execute()

    # 3. Insert sections + groups + questions
    n_questions = 0
    for p in test.passages:
        sec_res = sb.table("reading_sections").insert({
            "test_id": test_id,
            "part_number": p.part_number,
            "passage_text": p.passage_text,
        }).execute()
        section_id = sec_res.data[0]["id"]

        for g in p.groups:
            grp_res = sb.table("reading_question_groups").insert({
                "section_id": section_id,
                "instruction": g.instruction[:1000],
                "question_type": g.question_type,
                "sort_order": g.sort_order,
            }).execute()
            group_id = grp_res.data[0]["id"]

            if g.questions:
                question_rows = [
                    {
                        "group_id": group_id,
                        "question_text": q.question_text[:2000],
                        "options": json.dumps(q.options) if q.options else None,
                        "correct_answer": q.correct_answer,
                        "sort_order": q.sort_order,
                    }
                    for q in g.questions
                ]
                sb.table("reading_questions").insert(question_rows).execute()
                n_questions += len(question_rows)

    return n_questions


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and print stats without writing to DB")
    parser.add_argument("--min-questions", type=int, default=20,
                        help="Skip tests with fewer than N parsed questions (default 20)")
    parser.add_argument("--source-json", type=str,
                        default=str(Path.home() / "PycharmProjects" / "ChinaENG" / "practicepteonline_reading.json"),
                        help="Path to practicepteonline_reading.json")
    parser.add_argument("--limit", type=int, default=None,
                        help="Only import first N tests (useful for testing)")
    parser.add_argument("--export-json", type=str, default=None,
                        help="Write parsed output to this JSON file instead of DB")
    args = parser.parse_args()

    if not Path(args.source_json).exists():
        log.error(f"Source JSON not found: {args.source_json}")
        sys.exit(1)

    parsed_tests = list(parse_reading_file(args.source_json))
    log.info(f"Parsed {len(parsed_tests)} tests from {args.source_json}")

    # Filter by quality
    good = []
    for t in parsed_tests:
        n_q = sum(len(g.questions) for p in t.passages for g in p.groups)
        if n_q >= args.min_questions:
            good.append((t, n_q))

    log.info(f"After filtering (≥{args.min_questions} questions): {len(good)} tests qualify")

    if args.limit:
        good = good[:args.limit]
        log.info(f"Limited to {len(good)} tests")

    if args.export_json:
        out = [parsed_to_json(t) for t, _ in good]
        with open(args.export_json, "w") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        log.info(f"Wrote {len(out)} parsed tests to {args.export_json}")
        return

    if args.dry_run:
        log.info("DRY RUN — no DB writes. Sample summary:")
        for t, nq in good[:10]:
            n_p = len(t.passages)
            log.info(f"  {t.external_id}: {n_p} passages, {nq} questions")
        return

    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL / SUPABASE_SERVICE_KEY not set in .env.local")
        sys.exit(1)

    log.info(f"Connecting to Supabase: {SUPABASE_URL[:40]}...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    total_q = 0
    for t, _ in tqdm(good, desc="Importing reading tests"):
        try:
            total_q += write_test(sb, t)
        except Exception as e:
            log.warning(f"Failed to import {t.external_id}: {e}")

    log.info(f"✅ Imported {len(good)} tests, {total_q} questions total")


if __name__ == "__main__":
    main()
