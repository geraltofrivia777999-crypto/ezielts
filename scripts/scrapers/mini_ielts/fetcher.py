"""
Polite HTTP fetcher for mini-ielts.com.

  • Rate-limits to 1 req/sec by default
  • Caches responses to disk so re-runs are free
  • Retries on transient errors
  • Sets a real User-Agent
"""
from __future__ import annotations

import hashlib
import time
from pathlib import Path

import requests


DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


class Fetcher:
    def __init__(
        self,
        cache_dir: Path | str,
        *,
        delay_sec: float = 1.0,
        timeout: int = 30,
        user_agent: str = DEFAULT_UA,
        max_retries: int = 3,
    ):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.delay = delay_sec
        self.timeout = timeout
        self.user_agent = user_agent
        self.max_retries = max_retries
        self._last_request_at = 0.0

    def _cache_path(self, url: str) -> Path:
        h = hashlib.sha1(url.encode()).hexdigest()[:16]
        # keep .html for easy on-disk inspection
        return self.cache_dir / f"{h}.html"

    def get(self, url: str, *, use_cache: bool = True) -> str:
        cache = self._cache_path(url)
        if use_cache and cache.exists():
            return cache.read_text(encoding="utf-8")

        # Rate limit
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)

        last_err: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                resp = requests.get(
                    url,
                    headers={"User-Agent": self.user_agent},
                    timeout=self.timeout,
                )
                self._last_request_at = time.monotonic()
                resp.raise_for_status()
                cache.write_text(resp.text, encoding="utf-8")
                return resp.text
            except requests.RequestException as e:
                last_err = e
                # Exponential backoff
                time.sleep(min(2 ** attempt, 10))
        raise RuntimeError(f"Failed to fetch {url} after {self.max_retries} retries: {last_err}")
