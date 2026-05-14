#!/usr/bin/env python3
"""
Scrape Reading tests from mini-ielts.com and produce a JSON file ready
for downstream import into Supabase.

Polite by default:
  • Caches every HTTP response on disk; re-runs are instant + zero network
  • Rate-limits to 1 req/sec
  • Validates each test before including it in the output
  • Reports detailed stats so you can see WHY tests were rejected

Usage:
    # Scrape first 5 tests as a smoke test
    python scripts/scrape_mini_ielts_reading.py --limit 5

    # Full scrape (~660 tests, ~25 min the first time, instant from cache)
    python scripts/scrape_mini_ielts_reading.py --output data/mini_ielts_reading.json

    # Re-validate without re-downloading
    python scripts/scrape_mini_ielts_reading.py --cache-only
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path

from tqdm import tqdm

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(Path(__file__).parent))

from scrapers.mini_ielts.fetcher import Fetcher
from scrapers.mini_ielts.discover import enumerate_all_tests, TestRef
from scrapers.mini_ielts.parse_reading import parse_reading_test_html, to_dict
from scrapers.mini_ielts.parse_solution import parse_solution_html
from scrapers.mini_ielts.validator import validate_test


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def scrape_one(fetcher: Fetcher, ref: TestRef) -> dict | None:
    """Return a complete JSON-serialisable dict for one test, or None if rejected."""
    try:
        test_html = fetcher.get(ref.url)
        solution_html = fetcher.get(ref.solution_url)
    except Exception as e:
        log.warning(f"  ✗ {ref.test_id} fetch failed: {e}")
        return None

    test = parse_reading_test_html(test_html, test_id=ref.test_id, slug=ref.slug)
    answers = parse_solution_html(solution_html)

    report = validate_test(test, answers)
    if report.rejected:
        reasons = ", ".join(f"{i.where}:{i.reason}" for i in report.rejections[:5])
        log.warning(f"  ✗ {ref.test_id} {ref.slug[:40]}: rejected ({reasons})")
        return None

    # Combine parsed test + answers into single dict
    out = to_dict(test)
    out["answers"] = answers
    out["url"] = ref.url
    out["solution_url"] = ref.solution_url
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=str,
                        default=str(ROOT / "data" / "mini_ielts_reading.json"))
    parser.add_argument("--cache-dir", type=str,
                        default=str(ROOT / ".cache" / "mini_ielts"))
    parser.add_argument("--limit", type=int, default=None,
                        help="Stop after N tests (for smoke tests)")
    parser.add_argument("--max-pages", type=int, default=None,
                        help="Limit listing-page enumeration (each page = ~12 tests)")
    parser.add_argument("--cache-only", action="store_true",
                        help="Use only cached HTML; fail on cache miss instead of fetching")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="Seconds to wait between requests (default 1.0)")
    args = parser.parse_args()

    cache_dir = Path(args.cache_dir)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fetcher = Fetcher(cache_dir, delay_sec=args.delay)

    # Cache-only mode: monkey-patch the fetcher to never hit network
    if args.cache_only:
        original_get = fetcher.get
        def cache_only_get(url: str, **kw):
            return original_get(url, use_cache=True)
        fetcher.get = cache_only_get  # type: ignore[method-assign]

    log.info(f"Cache dir:    {cache_dir}")
    log.info(f"Output file:  {out_path}")

    refs = list(enumerate_all_tests(fetcher, max_pages=args.max_pages))
    log.info(f"Discovered {len(refs)} reading tests")

    if args.limit:
        refs = refs[: args.limit]
        log.info(f"Limited to {len(refs)} for this run")

    out_tests: list[dict] = []
    rejected = 0

    for ref in tqdm(refs, desc="Scraping"):
        result = scrape_one(fetcher, ref)
        if result is None:
            rejected += 1
        else:
            out_tests.append(result)

    # Stats
    n_questions = sum(t["total_questions"] for t in out_tests)
    log.info(f"\n✅ Accepted: {len(out_tests)} tests / {n_questions} questions")
    log.info(f"❌ Rejected: {rejected} tests")
    log.info(f"   Acceptance rate: {len(out_tests) / max(1, len(refs)):.0%}")

    out_path.write_text(
        json.dumps(out_tests, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log.info(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
