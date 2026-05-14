#!/usr/bin/env python3
"""Restructure listening: assign each question_group to a Section (1-4).

Strategy:
- For each listening_test, get all groups ordered by sort_order
- Assign groups to sections by cumulative question count:
  Section 1 = questions 1-10
  Section 2 = questions 11-20
  Section 3 = questions 21-30
  Section 4 = questions 31-40

Schema change required (run in Supabase SQL first):
  ALTER TABLE listening_question_groups
    ADD COLUMN IF NOT EXISTS section_number int CHECK (section_number BETWEEN 1 AND 4);
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env.local")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def assign_sections_for_test(test_id: str) -> dict:
    """Returns {section: question_count} stats for a test."""
    groups = sb.table("listening_question_groups").select(
        "id, sort_order"
    ).eq("test_id", test_id).order("sort_order").execute().data

    cumulative = 0
    stats = {1: 0, 2: 0, 3: 0, 4: 0}

    for g in groups:
        # Count questions in this group
        qcount_res = sb.table("listening_questions").select(
            "id", count="exact"
        ).eq("group_id", g["id"]).execute()
        qcount = qcount_res.count or 0

        # Determine section based on where cumulative falls
        # First group = section 1, then split at 10, 20, 30
        section = min(4, cumulative // 10 + 1)
        sb.table("listening_question_groups").update(
            {"section_number": section}
        ).eq("id", g["id"]).execute()

        stats[section] += qcount
        cumulative += qcount

    return stats


def main():
    print("Restructuring listening tests by section...")
    tests = sb.table("listening_tests").select("id, title").order("title").execute().data
    print(f"Total tests: {len(tests)}\n")

    for t in tests:
        try:
            stats = assign_sections_for_test(t["id"])
            print(f"  {t['title'][:50]:50} · {stats}")
        except Exception as e:
            print(f"  {t['title'][:50]:50} · ERROR: {e}")

    print("\n✅ Done")


if __name__ == "__main__":
    main()
