#!/usr/bin/env python3
"""Export current Supabase content tables to a timestamped local backup."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parent.parent
BACKUP_ROOT = ROOT / "data" / "supabase_backups"

TABLES = [
    "reading_tests",
    "reading_sections",
    "reading_question_groups",
    "reading_questions",
    "listening_tests",
    "listening_question_groups",
    "listening_questions",
    "writing_tasks",
    "speaking_topics",
    "user_content_seen",
]


def client():
    load_dotenv(ROOT / ".env.local")
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY")
    return create_client(url, key)


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


def main() -> int:
    sb = client()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = BACKUP_ROOT / stamp
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {"created_at": stamp, "tables": {}}
    for table in TABLES:
        rows = fetch_all(sb, table)
        (out_dir / f"{table}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        manifest["tables"][table] = len(rows)
        print(f"{table}: {len(rows)}")

    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Backup written to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
