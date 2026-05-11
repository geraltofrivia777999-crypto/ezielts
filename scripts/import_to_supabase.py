#!/usr/bin/env python3
"""
EZielts — JSON → Supabase Import Script
========================================
Imports all content from parsed JSON files into Supabase.

Usage:
    pip install supabase python-dotenv tqdm
    python scripts/import_to_supabase.py [--dry-run] [--only reading|listening|writing|speaking]

Environment variables (in .env.local):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJ...  (service_role key, bypasses RLS)
"""

import os
import sys
import json
import re
import uuid
import argparse
import logging
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv(Path(__file__).parent.parent / ".env.local")

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

JSON_DIR = Path(__file__).parent.parent.parent / "ChinaENG"

FILES = {
    "reading":   JSON_DIR / "practicepteonline_reading.json",
    "listening": JSON_DIR / "practicepteonline_listening.json",
    "writing":   JSON_DIR / "practicepteonline_writing.json",
    "speaking":  JSON_DIR / "practicepteonline_speaking.json",
    "readings2": JSON_DIR / "readings.json",          # Cathoven readings
    "writings2": JSON_DIR / "writings.json",
    "speakings2": JSON_DIR / "speakings.json",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def strip_html(text: str) -> str:
    """Remove HTML tags, decode common entities."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = (text
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&nbsp;", " ")
            .replace("&#8217;", "'")
            .replace("&#8216;", "'")
            .replace("&#8220;", '"')
            .replace("&#8221;", '"')
            .replace("&ldquo;", '"')
            .replace("&rdquo;", '"')
            )
    return re.sub(r"\s+", " ", text).strip()

def detect_question_type(instruction: str) -> str:
    """Guess IELTS question type from instruction text."""
    inst = (instruction or "").lower()
    if any(k in inst for k in ["true", "false", "not given", "yes", "no"]):
        return "tfng"
    if "matching" in inst or "match" in inst:
        return "matching"
    if "complete" in inst or "fill" in inst or "completion" in inst:
        return "completion"
    if "short answer" in inst or "no more than" in inst:
        return "short_answer"
    if any(k in inst for k in ["choose", "letter", "circle", "select"]):
        return "mcq"
    return "mcq"

def upsert(sb: Client, table: str, rows: list[dict], conflict_col: str = "external_id", dry: bool = False) -> int:
    """Upsert rows into a Supabase table. Returns count inserted."""
    if not rows:
        return 0
    if dry:
        log.info(f"[DRY] Would upsert {len(rows)} rows into {table}")
        return len(rows)
    # Supabase Python client upsert
    result = sb.table(table).upsert(rows, on_conflict=conflict_col).execute()
    return len(result.data) if result.data else len(rows)

# ── Reading importer ──────────────────────────────────────────────────────────

def import_reading(sb: Client, dry: bool = False):
    log.info("=== Reading ===")
    with open(FILES["reading"]) as f:
        tests = json.load(f)

    for item in tqdm(tests, desc="Reading tests"):
        ext_id = item.get("slug") or item.get("wordpress_id") or str(uuid.uuid4())
        category_raw = item.get("category", "Academic Reading")
        category = "general" if "general" in category_raw.lower() else "academic"
        title = strip_html(item.get("card_title") or item.get("title") or "")

        test_row = {
            "external_id": ext_id,
            "source":      "practicepteonline",
            "category":    category,
            "title":       title,
            "difficulty":  None,
        }

        if dry:
            log.debug(f"[DRY] reading_tests: {title[:50]}")
            continue

        # Upsert test
        res = sb.table("reading_tests").upsert(
            test_row, on_conflict="external_id"
        ).execute()
        test_id = res.data[0]["id"] if res.data else None
        if not test_id:
            # Already exists — fetch id
            res2 = sb.table("reading_tests").select("id").eq("external_id", ext_id).single().execute()
            test_id = res2.data["id"]

        # Passages → sections
        passages = item.get("passages") or []
        for pi, passage in enumerate(passages):
            p_text = strip_html(passage.get("text") or passage.get("html") or "")
            if not p_text:
                continue
            sec_row = {
                "test_id":      test_id,
                "part_number":  pi + 1,
                "passage_text": p_text,
            }
            # No external_id on sections — delete and re-insert to avoid dupes
            # (safe since full test upsert is idempotent via test external_id)
            sec_res = sb.table("reading_sections").insert(sec_row).execute()
            section_id = sec_res.data[0]["id"] if sec_res.data else None
            if not section_id:
                continue

            # Build question groups + questions for this passage
            # Question groups are test-level, we assign by passage index heuristic
            qgroups = item.get("question_groups") or []
            answers_map = item.get("answers") or {}  # {"1": "YES", "2": "NO", ...}

            for gi, qg in enumerate(qgroups):
                r = qg.get("range") or {}
                q_start = int(r.get("start") or 1)
                q_end   = int(r.get("end")   or q_start)
                instruction = strip_html(qg.get("instruction") or qg.get("text") or "")
                q_type = detect_question_type(instruction)

                grp_row = {
                    "section_id":    section_id,
                    "instruction":   instruction[:1000],
                    "question_type": q_type,
                    "sort_order":    gi,
                }
                grp_res = sb.table("reading_question_groups").insert(grp_row).execute()
                grp_id = grp_res.data[0]["id"] if grp_res.data else None
                if not grp_id:
                    continue

                # Extract individual question texts from blocks
                blocks = qg.get("blocks") or []
                q_texts = []
                for blk in blocks:
                    t = strip_html(blk.get("text") or "")
                    if t:
                        q_texts.append(t)

                # For each question number in range
                for qnum in range(q_start, q_end + 1):
                    q_text = q_texts[qnum - q_start] if (qnum - q_start) < len(q_texts) else f"Question {qnum}"
                    correct = answers_map.get(str(qnum), "")

                    # Determine options for MCQ
                    options = None
                    if q_type == "tfng":
                        options = ["TRUE", "FALSE", "NOT GIVEN"]
                    elif q_type == "mcq":
                        # Try to extract A/B/C/D from block texts (simplified)
                        opts = [b for b in q_texts if len(b) < 200 and b[0:2] in ("A.", "B.", "C.", "D.")]
                        if opts:
                            options = opts

                    q_row = {
                        "group_id":       grp_id,
                        "question_text":  q_text[:2000],
                        "options":        json.dumps(options) if options else None,
                        "correct_answer": str(correct).upper(),
                        "sort_order":     qnum,
                    }
                    sb.table("reading_questions").insert(q_row).execute()

    log.info(f"Reading import done: {len(tests)} tests")

# ── Listening importer ────────────────────────────────────────────────────────

def import_listening(sb: Client, dry: bool = False):
    log.info("=== Listening ===")
    with open(FILES["listening"]) as f:
        tests = json.load(f)

    for item in tqdm(tests, desc="Listening tests"):
        ext_id = item.get("slug") or str(uuid.uuid4())
        title  = strip_html(item.get("card_title") or "Listening Test")

        # Audio path — will be Storage CDN URL after upload
        audio_paths = item.get("audio_paths") or []
        # Format: practicepteonline_listening_audio/001_IELTS_Listening_Test_1_audio_1.mp3
        audio_url = None
        if audio_paths:
            fname = Path(audio_paths[0]).name
            audio_url = f"{SUPABASE_URL}/storage/v1/object/public/audio/{fname}"

        test_row = {
            "external_id":    ext_id,
            "source":         "practicepteonline",
            "title":          title,
            "section":        item.get("test_position"),
            "audio_url":      audio_url,
            "audio_duration": None,
        }

        if dry:
            log.debug(f"[DRY] listening_tests: {title[:50]} | audio: {audio_url}")
            continue

        res = sb.table("listening_tests").upsert(test_row, on_conflict="external_id").execute()
        test_id = res.data[0]["id"] if res.data else None
        if not test_id:
            res2 = sb.table("listening_tests").select("id").eq("external_id", ext_id).single().execute()
            test_id = res2.data["id"]

        answers_map = item.get("answers") or {}
        qgroups     = item.get("question_groups") or []

        for gi, qg in enumerate(qgroups):
            r = qg.get("range") or {}
            q_start = int(String(r.get("start") or 1)) if r else 1
            q_end   = int(String(r.get("end")   or q_start)) if r else q_start
            instruction = strip_html(qg.get("instruction") or "")
            q_type = detect_question_type(instruction)

            grp_row = {
                "test_id":       test_id,
                "instruction":   instruction[:1000],
                "question_type": q_type,
                "sort_order":    gi,
            }
            grp_res = sb.table("listening_question_groups").insert(grp_row).execute()
            grp_id  = grp_res.data[0]["id"] if grp_res.data else None
            if not grp_id:
                continue

            blocks  = qg.get("blocks") or []
            q_texts = [strip_html(b.get("text") or "") for b in blocks if strip_html(b.get("text") or "")]

            for qnum in range(q_start, q_end + 1):
                q_text  = q_texts[qnum - q_start] if (qnum - q_start) < len(q_texts) else f"Question {qnum}"
                correct = answers_map.get(str(qnum), "")

                options = None
                if q_type == "mcq":
                    opts = [b for b in q_texts if b[:2] in ("A.", "B.", "C.", "D.")]
                    if opts:
                        options = opts

                q_row = {
                    "group_id":       grp_id,
                    "question_text":  q_text[:2000],
                    "options":        json.dumps(options) if options else None,
                    "correct_answer": str(correct).upper(),
                    "sort_order":     qnum,
                }
                sb.table("listening_questions").insert(q_row).execute()

    log.info(f"Listening import done: {len(tests)} tests")

# ── Writing importer ──────────────────────────────────────────────────────────

def import_writing(sb: Client, dry: bool = False):
    log.info("=== Writing ===")
    with open(FILES["writing"]) as f:
        tasks = json.load(f)

    rows = []
    for item in tasks:
        ext_id   = item.get("slug") or str(uuid.uuid4())
        category = (item.get("category") or "").lower()
        task_num = str(item.get("task_number") or "1")

        # Determine exam_type
        if "general" in category:
            exam_type = "general"
        else:
            exam_type = "academic"

        task_type = "task1" if "1" in task_num else "task2"
        min_words = int(item.get("minimum_words") or (150 if task_type == "task1" else 250))
        prompt    = strip_html(item.get("prompt_text") or "")

        # Image URL: asset_path → Storage CDN
        image_url = None
        asset = item.get("asset_path") or ""
        if asset:
            fname = Path(asset).name
            image_url = f"{SUPABASE_URL}/storage/v1/object/public/images/writing/{fname}"

        rows.append({
            "external_id": ext_id,
            "source":      "practicepteonline",
            "task_type":   task_type,
            "exam_type":   exam_type,
            "prompt_text": prompt,
            "image_url":   image_url,
            "min_words":   min_words,
        })

    if dry:
        log.info(f"[DRY] Would upsert {len(rows)} writing tasks")
        return

    # Batch upsert in chunks of 100
    for i in tqdm(range(0, len(rows), 100), desc="Writing tasks"):
        chunk = rows[i:i+100]
        sb.table("writing_tasks").upsert(chunk, on_conflict="external_id").execute()

    log.info(f"Writing import done: {len(rows)} tasks")

# ── Speaking importer ─────────────────────────────────────────────────────────

def import_speaking(sb: Client, dry: bool = False):
    log.info("=== Speaking ===")
    with open(FILES["speaking"]) as f:
        topics = json.load(f)

    rows = []
    for item in topics:
        ext_id   = item.get("slug") or str(uuid.uuid4())
        category = (item.get("category") or "").lower()

        # Map category to part
        if "part 1" in category or "part1" in category:
            part = 1
        elif "part 3" in category or "part3" in category:
            part = 3
        else:
            part = 2  # default: cue card

        cue_text   = strip_html(item.get("cue_card_text") or item.get("card_title") or "")
        sample_ans = strip_html(item.get("sample_answer") or "")
        follow_up  = item.get("follow_up_questions") or []

        # follow_up_questions can be list or string
        if isinstance(follow_up, str):
            # Try to split by newline/numbering
            lines = [l.strip() for l in re.split(r"\n|\d+\.", follow_up) if l.strip() and len(l.strip()) > 10]
            follow_up = lines[:8]

        rows.append({
            "external_id":          ext_id,
            "source":               "practicepteonline",
            "part":                 part,
            "topic_text":           cue_text[:2000],
            "cue_card_points":      json.dumps(None),
            "follow_up_questions":  json.dumps(follow_up[:8] if follow_up else []),
            "sample_answer":        sample_ans[:5000] if sample_ans else None,
        })

    if dry:
        log.info(f"[DRY] Would upsert {len(rows)} speaking topics")
        return

    for i in tqdm(range(0, len(rows), 100), desc="Speaking topics"):
        chunk = rows[i:i+100]
        sb.table("speaking_topics").upsert(chunk, on_conflict="external_id").execute()

    log.info(f"Speaking import done: {len(rows)} topics")

# ── Cathoven readings importer ────────────────────────────────────────────────

def import_readings2(sb: Client, dry: bool = False):
    """Import Cathoven/secondary readings.json"""
    path = FILES["readings2"]
    if not path.exists():
        log.warning(f"File not found: {path}")
        return

    log.info("=== Readings (Cathoven) ===")
    with open(path) as f:
        data = json.load(f)

    # Normalise: could be list or dict
    if isinstance(data, dict):
        items = list(data.values())
    else:
        items = data

    imported = 0
    for item in tqdm(items, desc="Cathoven readings"):
        if not isinstance(item, dict):
            continue
        ext_id = item.get("id") or item.get("slug") or str(uuid.uuid4())
        title  = strip_html(item.get("title") or item.get("card_title") or "")
        text   = strip_html(item.get("text") or item.get("passage") or item.get("content") or "")
        if not text or len(text) < 100:
            continue

        test_row = {
            "external_id": f"cathoven_{ext_id}",
            "source":      "cathoven",
            "category":    "academic",
            "title":       title,
            "difficulty":  None,
        }

        if dry:
            imported += 1
            continue

        res = sb.table("reading_tests").upsert(test_row, on_conflict="external_id").execute()
        test_id = res.data[0]["id"] if res.data else None
        if not test_id:
            res2 = sb.table("reading_tests").select("id").eq("external_id", f"cathoven_{ext_id}").single().execute()
            test_id = res2.data["id"]

        sec_row = {
            "test_id":      test_id,
            "part_number":  1,
            "passage_text": text,
        }
        sb.table("reading_sections").insert(sec_row).execute()
        imported += 1

    log.info(f"Cathoven readings done: {imported} passages")

# ── Audio upload helper (run separately) ─────────────────────────────────────

def upload_audio_files(sb: Client, audio_dir: Path, dry: bool = False):
    """
    Upload .mp3 files from audio_dir to Supabase Storage bucket 'audio'.
    Run this separately after setting up Storage bucket.
    """
    log.info("=== Uploading audio files ===")
    mp3_files = list(audio_dir.glob("*.mp3"))
    log.info(f"Found {len(mp3_files)} mp3 files")

    for mp3 in tqdm(mp3_files, desc="Audio upload"):
        storage_path = f"{mp3.name}"
        if dry:
            log.debug(f"[DRY] Would upload: {mp3.name}")
            continue
        try:
            with open(mp3, "rb") as f:
                sb.storage.from_("audio").upload(
                    storage_path, f,
                    file_options={"content-type": "audio/mpeg", "upsert": "true"}
                )
        except Exception as e:
            log.warning(f"Upload failed {mp3.name}: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import EZielts content to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--only", choices=["reading","listening","writing","speaking","audio","all"], default="all")
    parser.add_argument("--audio-dir", type=str, help="Path to mp3 files for audio upload")
    args = parser.parse_args()

    log.info(f"Connecting to Supabase: {SUPABASE_URL[:40]}...")
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    if args.dry_run:
        log.info("DRY RUN — no data will be written")

    only = args.only
    dry  = args.dry_run

    if only in ("reading", "all"):
        import_reading(sb, dry)
        import_readings2(sb, dry)

    if only in ("listening", "all"):
        import_listening(sb, dry)

    if only in ("writing", "all"):
        import_writing(sb, dry)

    if only in ("speaking", "all"):
        import_speaking(sb, dry)

    if only == "audio":
        if not args.audio_dir:
            log.error("--audio-dir required for audio upload")
            sys.exit(1)
        upload_audio_files(sb, Path(args.audio_dir), dry)

    log.info("✅ Import complete")

if __name__ == "__main__":
    main()
