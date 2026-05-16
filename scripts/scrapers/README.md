# Content Scrapers

Polite, idempotent web scrapers for sourcing IELTS practice content.

## mini-ielts.com Reading scraper

Produces a JSON file containing ~600+ single-passage Reading tests with
properly extracted question text, options and correct answers.

### Architecture

```
scripts/
├── scrape_mini_ielts_reading.py   # CLI entry point
└── scrapers/
    └── mini_ielts/
        ├── fetcher.py             # rate-limited HTTP + on-disk cache
        ├── discover.py            # enumerate test URLs from listing pages
        ├── parse_reading.py       # parse one test HTML → MIReadingTest
        ├── parse_solution.py      # parse one solution HTML → {qid: answer}
        └── validator.py           # quality checks (mirrors content-filter.ts)
```

All modules are pure / side-effect-free (except the fetcher). The HTML
parser is unit-tested against locally-saved fixtures so the tests run
without network and never hit the live site.

### Usage

```bash
# Install deps (once)
pip install beautifulsoup4 requests tqdm python-dotenv

# Run unit tests (no network)
python3 -m unittest scripts.scrapers.tests.test_mini_ielts_parser -v

# Smoke-test on 5 tests
python3 scripts/scrape_mini_ielts_reading.py --limit 5 --output /tmp/smoke.json

# Full scrape (~660 tests, ~25 min the first time)
python3 scripts/scrape_mini_ielts_reading.py --output data/mini_ielts_reading.json

# Re-validate from cache only (no network, instant)
python3 scripts/scrape_mini_ielts_reading.py --cache-only --output data/mini_ielts_reading.json
```

### Politeness

- **Rate limit:** 1 request/second (configurable via `--delay`)
- **Cache:** every HTTP response is saved to `.cache/mini_ielts/<sha1>.html`
  so re-runs are instant and bandwidth-free.
- **Retries:** 3× with exponential backoff on transient errors
- **User-Agent:** real browser UA (not bot-like)

### Output format

```jsonc
[
  {
    "test_id": "1518",
    "slug": "australian-artist-margaret-preston",
    "url": "https://mini-ielts.com/1518/reading/australian-artist-margaret-preston",
    "solution_url": "https://mini-ielts.com/1518/view-solution/reading/australian-artist-margaret-preston",
    "title": "Australian artist Margaret Preston",
    "passage_text": "Margaret Preston's vibrant paintings...\n\n...",
    "total_questions": 13,
    "groups": [
      {
        "range_label": "Questions 1 - 7",
        "instruction": "Do the following statements agree with...",
        "question_type": "tfng",
        "questions": [
          { "qid": 1, "kind": "tfng", "options": ["TRUE","FALSE","NOT GIVEN"],
            "question_text": "Artists in the German aesthetic tradition portrayed nature realistically." },
          ...
        ]
      }
    ],
    "answers": { "1": "TRUE", "2": "NOT GIVEN", ... }
  },
  ...
]
```

### Quality filter

Tests are rejected at scrape time if ANY of these fail:

| Check | Threshold | Rationale |
|-------|-----------|-----------|
| Title | non-empty | A test without a title is incomplete data |
| Passage | ≥800 chars | Real IELTS passages are 700-900 words |
| Questions | ≥8 | mini-ielts tests have ~13; tolerate some parser loss |
| Answer coverage | ≥85% | Tests without answers can't be graded |
| Per-question | not placeholder/header/instruction | Catches parser slip-ups |

These rules mirror the JS `validateQuestionRow` in `lib/test-mapping/content-filter.ts`
so anything we'd hide in the UI is rejected at scrape time too.

### Mini-IELTS tests are SINGLE-passage

Each mini-ielts URL is one passage with ~13 questions. Real IELTS Reading
has 3 passages × 40 questions total. To assemble real mocks, group 3
scraped tests into a single `reading_tests` row with 3 `reading_sections`.
The existing `scripts/build_reading_mocks.py` does this from the DB.

## Legal & ethical notes

mini-ielts.com aggregates IELTS content much of which is sourced from
**Cambridge IELTS books** (copyrighted to Cambridge University Press) and
**British Council** materials.

- ✅ **Safe**: Using as study material on a **free tier** with attribution
  ("practice tests sourced from public IELTS resources")
- ✅ **Safe**: Using as a **quality benchmark** when generating your own
  AI-authored content
- ⚠️ **Risky**: Selling scraped content directly as your product. If your
  paid offering relies on copyrighted Cambridge passages without a
  licensing agreement, you're exposed to a takedown notice or worse.
- ❌ **Not safe**: Removing source attribution and presenting the content
  as original work.

**Recommended strategy:**
1. Use scraped content for the **free tier** (with attribution + a link to
  mini-ielts.com for direct credit).
2. For the **paid tier**, generate AI-original passages following the same
  question-type structure. The scraped corpus serves as a style/length
  reference, not a source.

The scraper itself is technically a normal browser doing the same thing a
human user would do, at 1 req/sec. That's well within typical
robots-allowed behaviour.

## Listening scraper — TODO

mini-ielts.com listening tests embed audio as YouTube iframes. Scraping
those requires:

1. Extract the YouTube video ID from the iframe `src`
2. Download audio with `yt-dlp` (legally murky — YouTube TOS)
3. Upload to Supabase Storage
4. Build the same parser/solution flow as Reading

Not implemented yet — happy to add when prioritised.
