"""
Parse an ielts-up.com Writing Task 2 topic page.

Each topic page (e.g. /writing/task-2-education-questions.html) lists ~5-10
essay prompts in the format:

  #1
  Some students work while studying. This often results in lacking time for…
  What do you think are the causes of this?
  What solutions can you suggest?

  #2
  Children are generally more successful in foreign language studies…
  Do you agree or disagree?

We split by `#N` markers and emit one prompt per marker.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup


@dataclass
class WritingPrompt:
    topic_slug: str       # e.g. "education"
    prompt_index: int     # 1-based, matches the #N in source
    prompt_text: str
    task_type: str = "task2"
    exam_type: str = "academic"
    min_words: int = 250

    @property
    def external_id(self) -> str:
        return f"ieltsup_w_{self.topic_slug}_{self.prompt_index}"


_RE_PROMPT_MARKER = re.compile(r"(?:^|\n)\s*#(\d+)\s*\n", re.M)


def parse_writing_topic_html(html: str, topic_slug: str) -> list[WritingPrompt]:
    soup = BeautifulSoup(html, "html.parser")
    # We extract from the main content area. The page text has a lot of nav
    # menu noise so we anchor on "< Back to the list of topics" or similar.
    text = soup.get_text("\n", strip=False)

    # Trim noise: keep content between the topic header and the footer markers
    anchor_start = re.search(
        r"common IELTS essay questions for [^\n]+\n+",
        text, re.I
    )
    if anchor_start:
        text = text[anchor_start.end():]
    # Cut off at a typical footer / "More topics" marker. The source HTML
    # collapses footer into the same text block when extracted via get_text(),
    # so we don't require a preceding newline.
    anchor_end = re.search(
        r"(?:Other topics|< Back to the list of topics|Subscribe for free|©|Privacy|"
        r"Tweet\b|Contact us\b|About the project)",
        text, re.I
    )
    if anchor_end:
        text = text[: anchor_end.start()]

    # Split by #N markers
    out: list[WritingPrompt] = []
    parts = _RE_PROMPT_MARKER.split(text)
    # `parts` = [preamble, "1", body1, "2", body2, ...]
    if len(parts) < 3:
        return out
    pairs = list(zip(parts[1::2], parts[2::2]))
    for idx_str, body in pairs:
        idx = int(idx_str)
        # Clean body: collapse whitespace, keep paragraph breaks
        body_lines = [ln.strip() for ln in body.split("\n") if ln.strip()]
        # Stop at next "#N" or empty marker (shouldn't happen but defensive)
        body_text = "\n".join(body_lines).strip()
        if not body_text or len(body_text) < 30:
            continue
        out.append(WritingPrompt(
            topic_slug=topic_slug,
            prompt_index=idx,
            prompt_text=body_text[:2000],
        ))
    return out
