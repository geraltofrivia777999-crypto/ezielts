"""
Parse an ielts-up.com Speaking sample page.

Structure:
  <h1>IELTS Speaking practice: Travel & Holidays</h1>
  <h3>Part 1</h3>
  …Q1, sample answer, Q2, sample answer…
  <h3>Part 2</h3>
  …cue card prompt + sample monologue…
  <h3>Part 3</h3>
  …discussion questions + sample answers…

Output is normalised into THREE topic rows (one per part) matching the
Supabase `speaking_topics` schema:

  • Part 1: topic_text = lead-in; follow_up_questions = JSON array
  • Part 2: topic_text = cue card prompt; cue_card_points = JSON array of bullets
  • Part 3: topic_text = lead-in; follow_up_questions = JSON array
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from bs4 import BeautifulSoup, Tag


PartNumber = Literal[1, 2, 3]


@dataclass
class SpeakingPart:
    part: PartNumber
    topic_slug: str                          # e.g. "travel-holidays"
    topic_title: str                         # "Travel & Holidays"
    topic_text: str                          # lead-in / cue card text
    questions: list[str] = field(default_factory=list)
    cue_card_points: list[str] = field(default_factory=list)
    sample_answer: str | None = None

    @property
    def external_id(self) -> str:
        return f"ieltsup_s_{self.topic_slug}_p{self.part}"


_RE_TITLE = re.compile(r"IELTS Speaking practice:\s*(.+)", re.I)


def _slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unknown"


def parse_speaking_html(html: str, override_slug: str | None = None) -> list[SpeakingPart]:
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.find("h1")
    full_title = h1.get_text(" ", strip=True) if h1 else ""
    m = _RE_TITLE.search(full_title)
    topic_title = m.group(1).strip() if m else full_title.strip()
    topic_slug = override_slug or _slugify(topic_title)

    # Locate the three Part headers and collect content between them.
    part_headers: list[tuple[int, Tag]] = []  # (part_num, tag)
    for h in soup.find_all(["h2", "h3", "h4"]):
        txt = h.get_text(" ", strip=True)
        mp = re.match(r"^\s*Part\s+([123])\b", txt, re.I)
        if mp:
            part_headers.append((int(mp.group(1)), h))

    if not part_headers:
        return []

    out: list[SpeakingPart] = []
    for i, (part_num, header) in enumerate(part_headers):
        # Walk forward until the next part header (or end of body)
        end_tag: Tag | None = part_headers[i + 1][1] if i + 1 < len(part_headers) else None
        chunks: list[str] = []
        for sib in _iter_until(header, end_tag):
            if not isinstance(sib, Tag):
                continue
            if sib.name in ("script", "style"):
                continue
            txt = sib.get_text("\n", strip=True)
            if txt:
                chunks.append(txt)

        body = "\n".join(chunks).strip()
        if not body:
            continue

        # Build the SpeakingPart based on the part number
        part_obj = _build_part(part_num, body, topic_slug=topic_slug, topic_title=topic_title)
        if part_obj is not None:
            out.append(part_obj)

    return out


def _iter_until(start: Tag, end: Tag | None):
    """Iterate next siblings of `start` until `end` (exclusive)."""
    sib = start.next_sibling
    while sib is not None:
        if sib is end:
            return
        yield sib
        sib = sib.next_sibling


def _build_part(part: int, body: str, *, topic_slug: str, topic_title: str) -> SpeakingPart | None:
    """Decompose a part's body text into structured fields."""
    lines = [ln.strip() for ln in body.split("\n") if ln.strip()]
    if not lines:
        return None

    if part == 2:
        # Cue card: first paragraph is the topic, followed by bullet points,
        # then the sample answer (which we capture separately).
        topic_text, bullets, sample = _split_cue_card(lines)
        return SpeakingPart(
            part=2,
            topic_slug=topic_slug,
            topic_title=topic_title,
            topic_text=topic_text,
            cue_card_points=bullets,
            sample_answer=sample,
        )

    # Part 1 and Part 3: questions interleaved with sample answers.
    # Heuristic: any line ending with "?" is a question.
    questions = [ln for ln in lines if ln.endswith("?")]
    # Lead-in: lines before the first question (usually a single intro sentence)
    lead: list[str] = []
    for ln in lines:
        if ln.endswith("?"):
            break
        lead.append(ln)
    topic_text = " ".join(lead).strip() or f"{topic_title} — Part {part}"

    return SpeakingPart(
        part=part,  # type: ignore[arg-type]
        topic_slug=topic_slug,
        topic_title=topic_title,
        topic_text=topic_text,
        questions=questions,
    )


_MAX_BULLET_LEN = 80   # bullets are short prompts (5-12 words); anything
                       # longer is the sample answer that follows the cue card.


def _split_cue_card(lines: list[str]) -> tuple[str, list[str], str | None]:
    """Cue card body.

    Two layout variants are observed on ielts-up.com:

    A) **Multi-line:** each bullet on its own line.
    B) **Single-line:** whole cue card glued: "Describe X. You should say:
       When you visited it Where is it situated …" — then the sample answer
       continues in the same block.

    Returns (topic_text, bullets, sample_answer).
    """
    full = "\n".join(lines)
    m = re.search(r"You\s+should\s+say\s*:?\s*", full, re.I)

    if not m:
        return full.strip(), [], None

    topic_text = full[: m.start()].strip()
    rest = full[m.end():].strip()

    # Hard-stop at known section markers
    stop = re.search(r"\b(Sample\s+Answer|Vocabulary|Useful\s+phrases?)\b", rest, re.I)
    if stop:
        bullets_blob = rest[: stop.start()].strip()
        sample = rest[stop.end():].strip() or None
    else:
        bullets_blob = rest
        sample = None

    # Variant A: newline-separated bullets → use them, capping length
    newline_split = [s.strip() for s in bullets_blob.split("\n") if s.strip()]
    if len(newline_split) >= 2 and all(len(s) <= _MAX_BULLET_LEN for s in newline_split):
        bullets = [re.sub(r"^[-•·*\s]+", "", s).strip() for s in newline_split]
        return topic_text, bullets, sample

    # Variant B: split on cue lead words. The 4th bullet on a typical IELTS
    # cue card starts with "and say" / "and explain" / "and tell" — include
    # those (case-insensitively) so the final bullet isn't swallowed.
    LEADS = (
        r"(When|Where|Who|What|Why|How|Describe|Explain"
        r"|[Aa]nd\s+(?:say|explain|tell)|[Aa]nd\s+why)"
    )
    matches = list(re.finditer(rf"(?:^|\s){LEADS}\b", bullets_blob))
    if len(matches) >= 2:
        bullets: list[str] = []
        sample_start_idx: int | None = None
        for i, mm in enumerate(matches):
            start = mm.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(bullets_blob)
            chunk = bullets_blob[start:end].strip().rstrip(",.;")
            chunk = re.sub(r"^\s+", "", chunk)

            # If the chunk is too long, the sample-answer prose has spilled
            # into it. Try to recover the actual bullet by cutting at the
            # first newline (cue card and sample answer are usually <br>-
            # separated in source HTML).
            if len(chunk) > _MAX_BULLET_LEN and "\n" in chunk:
                head, tail = chunk.split("\n", 1)
                head = head.strip().rstrip(",.;")
                if 0 < len(head) <= _MAX_BULLET_LEN:
                    bullets.append(head)
                # Sample answer starts at the tail (relative to chunk → blob)
                sample_start_idx = start + len(chunk) - len(tail)
                break

            if len(chunk) > _MAX_BULLET_LEN:
                sample_start_idx = start
                break

            if chunk:
                bullets.append(chunk)
        if sample_start_idx is not None and sample is None:
            sample = bullets_blob[sample_start_idx:].strip()
        return topic_text, bullets, sample

    # Fallback: keep as single combined string
    return topic_text, [bullets_blob] if bullets_blob else [], sample
