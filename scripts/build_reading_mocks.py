#!/usr/bin/env python3
"""Build reading_mock_tests by grouping single-passage tests into IELTS-style 3-passage mocks.

Strategy:
- Filter reading_tests where each has exactly 1 passage with 10-20 questions
- Group them in batches of 3 by category (academic/general)
- Total questions per mock should be ~40 (typical IELTS Reading)

Prerequisite SQL:
  CREATE TABLE reading_mock_tests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    category text NOT NULL,
    test_ids uuid[] NOT NULL,
    total_questions int,
    difficulty text,
    created_at timestamptz DEFAULT now()
  );
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env.local")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def count_questions_for_test(test_id: str) -> int:
    """Return total question count for a single reading test."""
    sections = sb.table("reading_sections").select("id").eq("test_id", test_id).execute().data
    if not sections:
        return 0
    total = 0
    for s in sections:
        groups = sb.table("reading_question_groups").select("id").eq("section_id", s["id"]).execute().data
        for g in groups:
            res = sb.table("reading_questions").select("id", count="exact").eq("group_id", g["id"]).execute()
            total += res.count or 0
    return total


def get_passage_count(test_id: str) -> int:
    res = sb.table("reading_sections").select("id", count="exact").eq("test_id", test_id).execute()
    return res.count or 0


def main():
    print("Loading all reading tests...")
    tests = sb.table("reading_tests").select("id, title, category, difficulty").execute().data
    print(f"Total: {len(tests)}")

    # Categorize by single-passage tests (the bulk)
    single_passage = {"academic": [], "general": []}
    for t in tests:
        if get_passage_count(t["id"]) == 1:
            category = t.get("category") or "academic"
            if category in single_passage:
                q_count = count_questions_for_test(t["id"])
                if 5 <= q_count <= 20:  # Reasonable per-passage count
                    single_passage[category].append({**t, "q_count": q_count})

    print(f"\nUsable single-passage tests:")
    print(f"  Academic: {len(single_passage['academic'])}")
    print(f"  General: {len(single_passage['general'])}")

    # Build mocks: each = 3 passages, ~40 questions total
    inserted = {"academic": 0, "general": 0}
    for category, items in single_passage.items():
        for i in range(0, len(items) - 2, 3):
            chunk = items[i:i + 3]
            total_q = sum(c["q_count"] for c in chunk)
            mock = {
                "title": f"IELTS {category.title()} Reading Mock #{inserted[category] + 1}",
                "category": category,
                "test_ids": [c["id"] for c in chunk],
                "total_questions": total_q,
                "difficulty": chunk[0].get("difficulty") or "medium",
            }
            try:
                sb.table("reading_mock_tests").insert(mock).execute()
                inserted[category] += 1
            except Exception as e:
                print(f"  Failed: {e}")

    print(f"\n✅ Created mock tests:")
    print(f"  Academic: {inserted['academic']}")
    print(f"  General: {inserted['general']}")


if __name__ == "__main__":
    main()
