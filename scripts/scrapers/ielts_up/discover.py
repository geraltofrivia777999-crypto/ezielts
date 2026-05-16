"""
URL enumeration for ielts-up.com.

The site does NOT use a query-string pagination model — each section has a
single listing page whose HTML contains all sub-URLs. We just grep the
HTML with narrow regex.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .fetcher import Fetcher

BASE = "https://ielts-up.com"

_LISTENING_HREF = re.compile(r'href="(/listening/ielts-listening-sample-(\d+)\.(\d+)\.html)"')
_SPEAKING_HREF = re.compile(r'href="(/speaking/ielts-speaking-sample-(\d+|[a-z-]+)\.html)"')
_WRITING_TOPIC_HREF = re.compile(r'href="(/writing/task-2-([a-z-]+)-questions\.html)"')


@dataclass(frozen=True)
class ListeningRef:
    test_num: int   # 5..14
    section: int    # 1..4

    @property
    def url(self) -> str:
        return f"{BASE}/listening/ielts-listening-sample-{self.test_num}.{self.section}.html"

    @property
    def mp3_url(self) -> str:
        return f"{BASE}/listening/{self.test_num}.{self.section}.mp3"

    @property
    def external_id(self) -> str:
        return f"ieltsup_l_{self.test_num}_{self.section}"


@dataclass(frozen=True)
class SpeakingRef:
    slug: str  # numeric or keyword (e.g. "1", "weather")

    @property
    def url(self) -> str:
        return f"{BASE}/speaking/ielts-speaking-sample-{self.slug}.html"

    @property
    def external_id(self) -> str:
        return f"ieltsup_s_{self.slug}"


@dataclass(frozen=True)
class WritingTopicRef:
    topic_slug: str  # e.g. "education", "environment"

    @property
    def url(self) -> str:
        return f"{BASE}/writing/task-2-{self.topic_slug}-questions.html"

    @property
    def external_id_for_prompt(self) -> str:
        # The prompt index is appended by the parser.
        return f"ieltsup_w_{self.topic_slug}"


# ── Enumerators ─────────────────────────────────────────────────────────────


def enumerate_listening(fetcher: Fetcher) -> list[ListeningRef]:
    html = fetcher.get(f"{BASE}/listening/ielts-listening-practice.html")
    seen: set[tuple[int, int]] = set()
    out: list[ListeningRef] = []
    for _full, test, section in _LISTENING_HREF.findall(html):
        key = (int(test), int(section))
        if key in seen:
            continue
        seen.add(key)
        out.append(ListeningRef(test_num=int(test), section=int(section)))
    out.sort(key=lambda r: (r.test_num, r.section))
    return out


def enumerate_speaking(fetcher: Fetcher) -> list[SpeakingRef]:
    html = fetcher.get(f"{BASE}/speaking/ielts-speaking-practice.html")
    seen: set[str] = set()
    out: list[SpeakingRef] = []
    for _full, slug in _SPEAKING_HREF.findall(html):
        if slug in seen:
            continue
        seen.add(slug)
        out.append(SpeakingRef(slug=slug))
    return out


def enumerate_writing_topics(fetcher: Fetcher) -> list[WritingTopicRef]:
    html = fetcher.get(f"{BASE}/writing/task-2-questions.html")
    seen: set[str] = set()
    out: list[WritingTopicRef] = []
    for _full, topic in _WRITING_TOPIC_HREF.findall(html):
        if topic in seen:
            continue
        seen.add(topic)
        out.append(WritingTopicRef(topic_slug=topic))
    return out
