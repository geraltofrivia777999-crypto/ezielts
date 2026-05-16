"""
Parse a single ielts-up.com listening test-section HTML page.

Each page covers ONE section (e.g. Test 10 Section 1). The structure is:
  • <h1>IELTS Listening Sample 10. Section 1</h1>
  • <audio><source src="10.1.mp3"></audio>
  • Body with the form / table / MCQ block (question presentation varies)
  • <div id="answers"> with an <ol> of correct answers, one per question

Strategy for questions:
  Listening questions are highly heterogeneous (forms, MCQ, table fills).
  Trying to split them into individual "question_text" units perfectly is
  fragile. Instead we:
    1. Extract the answer list verbatim — this is the ground truth.
    2. Capture the form/question block as a single `instruction` (used as
       context shown to the user above input fields).
    3. Emit one row per answer with question_text = "Question N" and the
       correct answer attached.

  The UI already renders a text input for each completion-style question
  (see app/tests/listening/page.tsx). The form/instruction tells the user
  what to fill in for each numbered blank.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup, Tag


@dataclass
class ParsedListeningSection:
    test_num: int
    section: int
    title: str               # e.g. "IELTS Listening Sample 10. Section 1"
    mp3_filename: str        # e.g. "10.1.mp3" (relative to /listening/)
    mp3_absolute_url: str    # e.g. "https://ielts-up.com/listening/10.1.mp3"
    instruction: str         # Form / table context (Markdown-ish plain text)
    answers: list[str] = field(default_factory=list)
    # Per-question raw answers; question N → answers[N-1]


_RE_TITLE = re.compile(r"Sample\s+(\d+)\s*\.\s*Section\s+(\d+)", re.I)
_BASE = "https://ielts-up.com/listening/"


def parse_listening_html(html: str) -> ParsedListeningSection:
    soup = BeautifulSoup(html, "html.parser")

    # 1. Title + test/section numbers
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    m = _RE_TITLE.search(title)
    test_num = int(m.group(1)) if m else 0
    section = int(m.group(2)) if m else 0

    # 2. Audio source
    src = soup.find("source")
    mp3_filename = (src.get("src") or "").strip() if src else ""
    mp3_abs = (_BASE + mp3_filename) if mp3_filename else ""

    # 3. Form / question instruction block
    instruction = _extract_instruction(soup)

    # 4. Answer list from #answers div
    answers = _extract_answers(soup)

    return ParsedListeningSection(
        test_num=test_num,
        section=section,
        title=title,
        mp3_filename=mp3_filename,
        mp3_absolute_url=mp3_abs,
        instruction=instruction,
        answers=answers,
    )


def _extract_instruction(soup: BeautifulSoup) -> str:
    """Best-effort extraction of the question form/table that follows the audio.

    We look at content between the <audio> element and the <div id="answers">.
    Returns a plain-text representation preserving line breaks.
    """
    audio = soup.find("audio")
    answers_div = soup.find(id="answers")
    if audio is None or answers_div is None:
        # Fallback: grab page text from h1 to "Show answers" button
        text = soup.get_text("\n", strip=True)
        m = re.search(r"Section\s+\d+\s*\n(.*?)Show\s+answers", text, re.S | re.I)
        return m.group(1).strip() if m else ""

    # Walk forward from audio until we hit answers_div
    chunks: list[str] = []
    el = audio
    while el is not None:
        el = _next_element(el)
        if el is None or el is answers_div:
            break
        if isinstance(el, Tag):
            # Skip script/style and the "Show answers" button div
            if el.name in ("script", "style"):
                continue
            txt = el.get_text(" ", strip=True)
            if txt and "Show answers" not in txt and len(txt) > 5:
                chunks.append(txt)
    # Dedupe consecutive duplicates
    cleaned: list[str] = []
    for c in chunks:
        if not cleaned or cleaned[-1] != c:
            cleaned.append(c)
    return "\n".join(cleaned).strip()[:4000]


def _next_element(el):
    """Like .next_element but skips NavigableStrings."""
    cur = el
    while True:
        cur = cur.next_element
        if cur is None:
            return None
        if isinstance(cur, Tag):
            return cur


def _extract_answers(soup: BeautifulSoup) -> list[str]:
    """Pull answers from <div id="answers"> in source order.

    Layout observed:
      <div id="answers">
        <p>ANSWERS</p>
        <p>Section N</p>
        <ol>
          <li>Elsinore</li>
          <li>077896245</li>
          ...
        </ol>
      </div>
    """
    div = soup.find(id="answers")
    if div is None:
        return []
    ol = div.find("ol")
    if ol is not None:
        return [li.get_text(" ", strip=True) for li in ol.find_all("li") if li.get_text(strip=True)]
    # Fallback: pick lines after "Section N" header
    text = div.get_text("\n", strip=True)
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    # Drop the header line(s) — keep anything that doesn't start with capitalised "Section"
    out: list[str] = []
    for ln in lines:
        if re.match(r"^(answers?|section\s+\d|each question|correct)\b", ln, re.I):
            continue
        out.append(ln)
    return out
