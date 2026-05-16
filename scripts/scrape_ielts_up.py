#!/usr/bin/env python3
"""
Scrape Listening, Writing and Speaking content from ielts-up.com.

Usage:
    # Smoke test each section (1-5 items, ~10-30 sec)
    python scripts/scrape_ielts_up.py listening --limit 3
    python scripts/scrape_ielts_up.py writing    --limit 2
    python scripts/scrape_ielts_up.py speaking   --limit 3

    # Full scrape
    python scripts/scrape_ielts_up.py listening   # ~40 sections, ~3 min
    python scripts/scrape_ielts_up.py writing     # 12 topics × ~7 prompts = ~80
    python scripts/scrape_ielts_up.py speaking    # ~11 topics × 3 parts = ~33

    # Custom output / cache locations
    python scripts/scrape_ielts_up.py listening \\
        --output data/listening.json --cache-dir .cache/ielts_up

    # Re-validate without re-downloading (cache-only mode)
    python scripts/scrape_ielts_up.py writing --cache-only

Politeness:
    1 req/sec by default. Every response cached on disk (re-runs are free).
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import asdict
from itertools import islice
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(Path(__file__).parent))

from scrapers.ielts_up.fetcher import Fetcher
from scrapers.ielts_up.discover import (
    enumerate_listening,
    enumerate_speaking,
    enumerate_writing_topics,
)
from scrapers.ielts_up.parse_listening import parse_listening_html
from scrapers.ielts_up.parse_writing import parse_writing_topic_html
from scrapers.ielts_up.parse_speaking import parse_speaking_html


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ─── Section runners ────────────────────────────────────────────────────────


def run_listening(fetcher: Fetcher, limit: int | None) -> list[dict]:
    refs = enumerate_listening(fetcher)
    log.info(f"Discovered {len(refs)} listening sections")
    if limit:
        refs = refs[:limit]

    out: list[dict] = []
    for ref in refs:
        try:
            html = fetcher.get(ref.url)
            parsed = parse_listening_html(html)
            if not parsed.answers:
                log.warning(f"  ✗ {ref.external_id}: no answers parsed")
                continue
            d = asdict(parsed)
            d["external_id"] = ref.external_id
            d["url"] = ref.url
            out.append(d)
            log.info(f"  ✓ {ref.external_id}: {len(parsed.answers)} answers, mp3 {parsed.mp3_filename}")
        except Exception as e:
            log.warning(f"  ✗ {ref.external_id} failed: {e}")
    return out


def run_writing(fetcher: Fetcher, limit: int | None) -> list[dict]:
    topics = enumerate_writing_topics(fetcher)
    log.info(f"Discovered {len(topics)} writing topics")
    if limit:
        topics = topics[:limit]

    out: list[dict] = []
    for t in topics:
        try:
            html = fetcher.get(t.url)
            prompts = parse_writing_topic_html(html, topic_slug=t.topic_slug)
            for p in prompts:
                d = asdict(p)
                d["external_id"] = p.external_id  # @property is not in asdict()
                out.append(d)
            log.info(f"  ✓ {t.topic_slug}: {len(prompts)} prompts")
        except Exception as e:
            log.warning(f"  ✗ {t.topic_slug} failed: {e}")
    return out


def run_speaking(fetcher: Fetcher, limit: int | None) -> list[dict]:
    refs = enumerate_speaking(fetcher)
    log.info(f"Discovered {len(refs)} speaking topics")
    if limit:
        refs = refs[:limit]

    out: list[dict] = []
    for ref in refs:
        try:
            html = fetcher.get(ref.url)
            parts = parse_speaking_html(html, override_slug=ref.slug)
            for p in parts:
                d = asdict(p)
                d["external_id"] = p.external_id  # @property is not in asdict()
                d["source_url"] = ref.url
                out.append(d)
            log.info(f"  ✓ {ref.slug}: parts = {[p.part for p in parts]}")
        except Exception as e:
            log.warning(f"  ✗ {ref.slug} failed: {e}")
    return out


# ─── Main ───────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("section", choices=["listening", "writing", "speaking"],
                        help="Which IELTS section to scrape")
    parser.add_argument("--output", type=str, default=None,
                        help="JSON output path (default: data/ielts_up_<section>.json)")
    parser.add_argument("--cache-dir", type=str,
                        default=str(ROOT / ".cache" / "ielts_up"))
    parser.add_argument("--limit", type=int, default=None,
                        help="Stop after N items (smoke testing)")
    parser.add_argument("--cache-only", action="store_true",
                        help="Use only cached HTML; raise on cache miss")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="Seconds to wait between requests")
    args = parser.parse_args()

    cache_dir = Path(args.cache_dir)
    out_path = Path(args.output or (ROOT / "data" / f"ielts_up_{args.section}.json"))
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fetcher = Fetcher(cache_dir, delay_sec=args.delay)
    if args.cache_only:
        original_get = fetcher.get
        def _cache_only(url: str, **kw):
            return original_get(url, use_cache=True)
        fetcher.get = _cache_only  # type: ignore[method-assign]

    log.info(f"Section:    {args.section}")
    log.info(f"Cache dir:  {cache_dir}")
    log.info(f"Output:     {out_path}")

    if args.section == "listening":
        data = run_listening(fetcher, args.limit)
    elif args.section == "writing":
        data = run_writing(fetcher, args.limit)
    else:
        data = run_speaking(fetcher, args.limit)

    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info(f"\n✅ {len(data)} items written → {out_path} ({out_path.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
