#!/usr/bin/env python3
"""Diagnose IELTS test structure in the DB vs official IELTS Academic format."""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from collections import Counter

load_dotenv(Path(__file__).parent.parent / ".env.local")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def hdr(s):
    print(f"\n{'=' * 60}\n  {s}\n{'=' * 60}")


# ─── LISTENING ────────────────────────────────────────────────────────────────
hdr("LISTENING — структура")
tests = sb.table("listening_tests").select("id, title, section, audio_url").execute().data
print(f"Всего тестов: {len(tests)}")
print(f"С audio_url: {sum(1 for t in tests if t.get('audio_url'))}")
print(f"Section distribution: {Counter((t.get('section') or 'NULL') for t in tests)}")
print("\nПример первых 3 тестов:")
for t in tests[:3]:
    groups = sb.table("listening_question_groups").select("id, instruction, question_type").eq("test_id", t["id"]).execute().data
    total_q = 0
    for g in groups:
        qs = sb.table("listening_questions").select("id", count="exact").eq("group_id", g["id"]).execute()
        total_q += qs.count or 0
    print(f"  {t['title'][:45]:45} · section={t['section']} · groups={len(groups)} · questions={total_q}")


# ─── READING ──────────────────────────────────────────────────────────────────
hdr("READING — структура")
tests = sb.table("reading_tests").select("id, title, category").execute().data
print(f"Всего тестов: {len(tests)}")
print(f"Categories: {Counter((t.get('category') or 'NULL') for t in tests)}")
print("\nПример первых 5 тестов (passages × вопросы):")
for t in tests[:5]:
    sections = sb.table("reading_sections").select("id, part_number").eq("test_id", t["id"]).execute().data
    total_q = 0
    for s in sections:
        groups = sb.table("reading_question_groups").select("id").eq("section_id", s["id"]).execute().data
        for g in groups:
            qs = sb.table("reading_questions").select("id", count="exact").eq("group_id", g["id"]).execute()
            total_q += qs.count or 0
    print(f"  {t['title'][:45]:45} · passages={len(sections)} · total_questions={total_q}")

# Distribution of passages-per-test
hdr("READING — распределение количества passages в тесте")
passage_counts = Counter()
for t in tests:
    secs = sb.table("reading_sections").select("id", count="exact").eq("test_id", t["id"]).execute()
    passage_counts[secs.count or 0] += 1
for c, n in sorted(passage_counts.items()):
    print(f"  {c} passage(s): {n} тестов")


# ─── WRITING ──────────────────────────────────────────────────────────────────
hdr("WRITING — структура")
tasks = sb.table("writing_tasks").select("id, task_type, exam_type, prompt_text, image_url, min_words").execute().data
print(f"Всего заданий: {len(tasks)}")
print(f"Task type: {Counter(t.get('task_type') for t in tasks)}")
print(f"Exam type: {Counter(t.get('exam_type') for t in tasks)}")
print(f"С image_url: {sum(1 for t in tasks if t.get('image_url'))}")
print(f"Min_words median: {sorted(t.get('min_words') or 0 for t in tasks)[len(tasks)//2]}")


# ─── SPEAKING ─────────────────────────────────────────────────────────────────
hdr("SPEAKING — структура")
topics = sb.table("speaking_topics").select("id, part, topic_text, follow_up_questions, sample_answer").execute().data
print(f"Всего топиков: {len(topics)}")
print(f"Part distribution: {Counter(t.get('part') for t in topics)}")
print(f"С sample_answer: {sum(1 for t in topics if t.get('sample_answer'))}")
print(f"С follow_up_questions: {sum(1 for t in topics if t.get('follow_up_questions'))}")


# ─── ВЫВОДЫ ───────────────────────────────────────────────────────────────────
hdr("ВЫВОДЫ — соответствие официальному IELTS Academic")
print("""
Официальный формат:
  LISTENING: 4 секции × 10 вопросов = 40 вопросов всего, 1 аудио
  READING:   3 passage × 13-14 вопросов = 40 вопросов всего
  WRITING:   Task 1 (150+ слов) + Task 2 (250+ слов)
  SPEAKING:  Part 1 (4-5 мин) + Part 2 cue card (3-4 мин) + Part 3 (4-5 мин)
""")
