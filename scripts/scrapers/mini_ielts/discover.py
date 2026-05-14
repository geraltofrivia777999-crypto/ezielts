"""
Enumerate reading-test URLs from mini-ielts.com listing pages.

Listing pages are paginated at /reading?page=N. Each page lists ~12 tests.
This module yields (test_id, slug, full_url) tuples.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from .fetcher import Fetcher


BASE = "https://mini-ielts.com"
_TEST_LINK = re.compile(r'/(\d+)/reading/([a-z0-9-]+)')
_PAGE_LINK = re.compile(r'/reading\?page=(\d+)')


@dataclass(frozen=True)
class TestRef:
    test_id: str
    slug: str

    @property
    def url(self) -> str:
        return f"{BASE}/{self.test_id}/reading/{self.slug}"

    @property
    def solution_url(self) -> str:
        return f"{BASE}/{self.test_id}/view-solution/reading/{self.slug}"


def parse_listing(html: str) -> list[TestRef]:
    """Return unique TestRefs in the order they first appear on the page."""
    seen: set[tuple[str, str]] = set()
    out: list[TestRef] = []
    for tid, slug in _TEST_LINK.findall(html):
        key = (tid, slug)
        if key in seen:
            continue
        seen.add(key)
        out.append(TestRef(test_id=tid, slug=slug))
    return out


def discover_max_page(html: str) -> int:
    """Return the highest page number referenced by the pagination nav."""
    pages = [int(m) for m in _PAGE_LINK.findall(html)]
    return max(pages) if pages else 1


def enumerate_all_tests(fetcher: Fetcher, max_pages: int | None = None) -> Iterable[TestRef]:
    """
    Yield every reading-test ref by walking the paginated listing.
    `max_pages` caps the walk for development; None = walk all.
    """
    # Fetch page 1 to discover the pagination range
    first_html = fetcher.get(f"{BASE}/reading?page=1")
    last_page = discover_max_page(first_html)
    if max_pages is not None:
        last_page = min(last_page, max_pages)

    yielded: set[tuple[str, str]] = set()
    for page in range(1, last_page + 1):
        if page == 1:
            html = first_html
        else:
            html = fetcher.get(f"{BASE}/reading?page={page}")
        for ref in parse_listing(html):
            key = (ref.test_id, ref.slug)
            if key in yielded:
                continue
            yielded.add(key)
            yield ref
