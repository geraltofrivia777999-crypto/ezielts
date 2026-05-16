#!/usr/bin/env python3
"""
Import scraped mini-ielts.com Reading tests into Supabase.

Reads the JSON produced by `scrape_mini_ielts_reading.py` and writes one
`reading_tests` row per source test (single-passage, structured with
groups + questions). Output is idempotent:

  • `external_id = "miniielts_{test_id}"` ensures re-runs upsert instead
    of duplicating.
  • Child rows (sections / groups / questions) are wiped per test before
    re-insertion so updates are clean.

The resulting rows are shaped for downstream consumption by
`scripts/build_reading_mocks.py`, which groups single-passage tests into
3-passage IELTS-style mock tests.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/import_mini_ielts_reading.py \\
        --input data/mini_ielts_reading.json \\
        [--dry-run] [--limit N] [--source-label mini-ielts]

Environment (in .env.local):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJ...   # bypasses RLS — required for INSERTs
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parent.parent

# Imports that depend on third-party deps (dotenv, supabase, tqdm) live in main()
# so that the pure projection helpers (project_for_db etc.) can be unit-tested
# in environments without those packages installed.

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ─── Pure (testable) projection: scraped JSON → DB rows ─────────────────────


def project_for_db(scraped_test: dict[str, Any], source_label: str = "mini-ielts") -> dict[str, Any]:
    """
    Convert ONE scraped test into the nested structure the importer writes.
    Pure function — no DB calls — for unit-testing.

    Returns a dict with:
      • test_row:     reading_tests insert payload
      • passage_text: str
      • groups: list of {
            instruction: str,
            question_type: str,
            sort_order: int,
            questions: list of {question_text, options (or None), correct_answer, sort_order}
        }
    """
    test_id = str(scraped_test["test_id"])
    answers = scraped_test.get("answers") or {}

    test_row = {
        "external_id": f"miniielts_{test_id}",
        "source":      source_label,
        "category":    "academic",   # mini-ielts is Academic IELTS Reading
        "title":       scraped_test.get("title", f"Reading Test {test_id}"),
        "difficulty":  None,
    }

    groups_out: list[dict[str, Any]] = []
    for gi, g in enumerate(scraped_test.get("groups") or []):
        question_rows: list[dict[str, Any]] = []
        for q in g.get("questions") or []:
            qid = str(q["qid"])
            correct = answers.get(qid)
            if correct is None or not str(correct).strip():
                # Skip ungraded questions — they can't be auto-checked anyway
                continue
            opts = q.get("options")
            question_rows.append({
                "question_text":  (q.get("question_text") or "").strip()[:2000],
                "options":        opts if (opts and len(opts) > 0) else None,
                "correct_answer": str(correct).strip(),  # CASING PRESERVED
                "sort_order":     int(qid),
            })

        if not question_rows:
            continue  # empty group, skip

        groups_out.append({
            "instruction":   (g.get("instruction") or "").strip()[:1000],
            "question_type": _normalise_qtype(g.get("question_type", "mcq")),
            "sort_order":    gi,
            "questions":     question_rows,
        })

    return {
        "test_row":     test_row,
        "passage_text": (scraped_test.get("passage_text") or "").strip(),
        "groups":       groups_out,
    }


# Map scraper's question_type vocabulary to the schema's CHECK constraint.
# Schema allows: 'mcq' | 'tfng' | 'matching' | 'completion' | 'short_answer'
_QTYPE_ALIAS = {
    "tfng":          "tfng",
    "ynng":          "tfng",  # Yes/No/Not Given uses same shape on DB side
    "mcq":           "mcq",
    "matching":      "matching",
    "heading":       "matching",        # matching headings
    "headings":      "matching",
    "completion":    "completion",
    "summary":       "completion",
    "sentence":      "completion",
    "short_answer":  "short_answer",
    "short-answer":  "short_answer",
}


def _normalise_qtype(raw: str) -> str:
    raw_lower = (raw or "").lower().strip()
    return _QTYPE_ALIAS.get(raw_lower, "mcq")


# ─── Counts (used for reporting + dry-run output) ───────────────────────────


def total_questions(projected: dict[str, Any]) -> int:
    return sum(len(g["questions"]) for g in projected["groups"])


# ─── DB writer (only used when --dry-run is OFF) ────────────────────────────


def write_to_db(sb, projected: dict[str, Any]) -> int:
    """Write one projected test to Supabase. Returns # of questions inserted."""
    test_row = projected["test_row"]
    ext_id = test_row["external_id"]

    # 1. Upsert reading_tests row
    res = sb.table("reading_tests").upsert(test_row, on_conflict="external_id").execute()
    if res.data:
        test_id = res.data[0]["id"]
    else:
        # Already existed — fetch its id
        res2 = sb.table("reading_tests").select("id").eq("external_id", ext_id).single().execute()
        test_id = res2.data["id"]

    # 2. Wipe child rows for this test (cascade deletes groups + questions)
    sb.table("reading_sections").delete().eq("test_id", test_id).execute()

    # 3. Single section (mini-ielts tests are single-passage)
    sec_res = sb.table("reading_sections").insert({
        "test_id":      test_id,
        "part_number":  1,
        "passage_text": projected["passage_text"],
    }).execute()
    section_id = sec_res.data[0]["id"]

    # 4. Groups + questions
    n_questions = 0
    for g in projected["groups"]:
        grp_res = sb.table("reading_question_groups").insert({
            "section_id":    section_id,
            "instruction":   g["instruction"],
            "question_type": g["question_type"],
            "sort_order":    g["sort_order"],
        }).execute()
        group_id = grp_res.data[0]["id"]

        # Convert options list → JSON-string (schema column is jsonb)
        question_rows = [
            {
                "group_id":       group_id,
                "question_text":  q["question_text"],
                "options":        json.dumps(q["options"]) if q["options"] else None,
                "correct_answer": q["correct_answer"],
                "sort_order":     q["sort_order"],
            }
            for q in g["questions"]
        ]
        sb.table("reading_questions").insert(question_rows).execute()
        n_questions += len(question_rows)

    return n_questions


# ─── Main ───────────────────────────────────────────────────────────────────


def main() -> int:
    # Lazy imports: needed only at runtime, not for unit tests.
    # dotenv + tqdm are optional — graceful fallback if missing.
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env.local")
    except ImportError:
        log.warning("python-dotenv not installed — env vars must be set manually")

    try:
        from tqdm import tqdm
    except ImportError:
        # Fallback: plain identity iterator
        def tqdm(it, **kw):  # type: ignore[no-redef]
            return it

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str,
                        default=str(ROOT / "data" / "mini_ielts_reading.json"),
                        help="Path to JSON produced by scrape_mini_ielts_reading.py")
    parser.add_argument("--source-label", type=str, default="mini-ielts",
                        help="Value to write into reading_tests.source")
    parser.add_argument("--limit", type=int, default=None,
                        help="Only import first N tests (smoke testing)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print a summary of what would be inserted, write nothing")
    args = parser.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        log.error(f"Input file not found: {in_path}")
        log.error("Did you run scrape_mini_ielts_reading.py first?")
        return 1

    log.info(f"Reading {in_path}")
    scraped = json.loads(in_path.read_text(encoding="utf-8"))
    log.info(f"Loaded {len(scraped)} scraped tests")

    if args.limit:
        scraped = scraped[: args.limit]
        log.info(f"Limited to first {len(scraped)} for this run")

    # Project all tests first (catch bad data before DB writes)
    projected_tests = []
    for st in scraped:
        try:
            p = project_for_db(st, source_label=args.source_label)
            if not p["passage_text"] or not p["groups"]:
                log.warning(f"  ✗ {st.get('test_id')}: empty after projection, skipping")
                continue
            projected_tests.append(p)
        except Exception as e:
            log.warning(f"  ✗ {st.get('test_id')}: projection failed ({e})")

    log.info(f"Ready to write: {len(projected_tests)} tests, "
             f"{sum(total_questions(p) for p in projected_tests)} questions")

    if args.dry_run:
        log.info("DRY RUN — no writes. Sample of first 5 tests:")
        for p in projected_tests[:5]:
            log.info(f"  {p['test_row']['external_id']}: "
                     f"{p['test_row']['title'][:50]} → "
                     f"{len(p['groups'])} groups / {total_questions(p)} questions")
        return 0

    # Resolve Supabase creds
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not supabase_url or not supabase_key:
        log.error("Set SUPABASE_URL + SUPABASE_SERVICE_KEY in .env.local")
        return 1
    if "SERVICE" not in (os.environ.get("SUPABASE_SERVICE_KEY") or "X"):
        log.warning("Using ANON key — INSERTs may fail under RLS. "
                    "Use SUPABASE_SERVICE_KEY for bulk imports.")

    from supabase import create_client
    sb = create_client(supabase_url, supabase_key)

    log.info(f"Connected to {supabase_url[:40]}...")

    total_q_written = 0
    failed = 0
    for p in tqdm(projected_tests, desc="Importing"):  # noqa: F821 (imported lazily above)
        try:
            total_q_written += write_to_db(sb, p)
        except Exception as e:
            failed += 1
            log.warning(f"  ✗ {p['test_row']['external_id']} insert failed: {e}")

    log.info(f"\n✅ Imported {len(projected_tests) - failed} tests, "
             f"{total_q_written} questions")
    if failed:
        log.warning(f"❌ {failed} tests failed (see logs above)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
