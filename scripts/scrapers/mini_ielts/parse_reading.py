"""
mini-ielts.com Reading-test HTML parser.

Pure / side-effect-free. Given the raw HTML of a single reading test page
(e.g. https://mini-ielts.com/1518/reading/australian-artist-margaret-preston)
this module extracts a structured representation:

  • title
  • passage_text (the single passage — mini-ielts tests are single-passage)
  • question_groups, each with:
      - instruction text
      - question_type ('mcq' | 'tfng' | 'completion' | 'matching')
      - list of questions with options + answer slot

Answers are NOT on the test page — they live at /view-solution/...; see
`parse_solution.py` for that. The two outputs are joined by question id.

The module is unit-tested against saved HTML fixtures (no network).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from bs4 import BeautifulSoup, Tag, NavigableString


# ─── Data classes ───────────────────────────────────────────────────────────

@dataclass
class MIQuestion:
    """A single question parsed from mini-ielts HTML."""
    qid: int                       # 1-based question number (matches `id='q1'` in HTML)
    question_text: str
    options: list[str] | None      # None for free-text completion
    kind: str                      # 'mcq' | 'tfng' | 'completion' | 'matching'


@dataclass
class MIGroup:
    """A question group (e.g. "Questions 1-7: TFNG")."""
    range_label: str               # "Questions 1 - 7"
    instruction: str               # full rubric paragraph(s)
    question_type: str             # 'mcq' | 'tfng' | 'completion' | 'matching'
    questions: list[MIQuestion] = field(default_factory=list)


@dataclass
class MIReadingTest:
    """A complete mini-ielts reading test (one passage, ~13 questions)."""
    test_id: str                   # numeric ID from URL
    slug: str                      # url slug
    title: str
    passage_text: str
    groups: list[MIGroup] = field(default_factory=list)

    @property
    def total_questions(self) -> int:
        return sum(len(g.questions) for g in self.groups)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _clean_text(s: str | None) -> str:
    """Collapse whitespace and strip."""
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def _detect_kind(instruction: str, options_present: bool) -> str:
    """Best-effort question-type classification."""
    inst = instruction.lower()
    if "true" in inst and "false" in inst and "not given" in inst:
        return "tfng"
    if "yes" in inst and "no" in inst and "not given" in inst:
        return "tfng"  # Y/N/NG family — same DB type
    if "match" in inst:
        return "matching"
    if not options_present:
        return "completion"
    if "choose" in inst and ("letter" in inst or "answer" in inst):
        return "mcq"
    return "mcq" if options_present else "completion"


# ─── Passage extraction ─────────────────────────────────────────────────────

def _extract_passage(soup: BeautifulSoup) -> tuple[str, str]:
    """Return (title, passage_text) from the .reading-text panel."""
    passage_div = soup.select_one("div.reading-text")
    if passage_div is None:
        return ("", "")

    # Title is the only <h2> inside the .reading-text panel
    h2 = passage_div.select_one("h2")
    title = _clean_text(h2.get_text(" ", strip=True)) if h2 else ""

    # Drop highlight toolbar, ads, and the title before extracting paragraphs
    for node in passage_div.select(".formatbar, .ads, h2, img, script, style"):
        node.decompose()

    paragraphs: list[str] = []
    for p in passage_div.select("p"):
        text = _clean_text(p.get_text(" ", strip=True))
        if text:
            paragraphs.append(text)

    # Join with blank lines so the UI's paragraph-splitter (text.split("\n\n"))
    # gives us multiple visible paragraphs.
    passage_text = "\n\n".join(paragraphs)
    return title, passage_text


# ─── Question-group extraction ──────────────────────────────────────────────

# Match a question marker like "<b>1 </b>" or "<b>12 </b>" — used to detect
# inline question numbers inside <p> tags.
_Q_NUMBER_PATTERN = re.compile(r"^\s*(\d{1,2})\s*$")


def _extract_select_question(select_tag: Tag) -> tuple[int, list[str]] | None:
    """From a <select id='qN'> tag extract (qid, options[])."""
    qid_attr = select_tag.get("id", "")
    m = re.fullmatch(r"q(\d{1,2})", qid_attr)
    if not m:
        return None
    qid = int(m.group(1))
    options = [
        _clean_text(opt.get_text())
        for opt in select_tag.find_all("option")
        if opt.get("value", "").strip()  # skip the empty placeholder option
    ]
    return qid, options


def _extract_input_question_id(input_tag: Tag) -> int | None:
    """From an <input id='qN' type='text'> return N."""
    qid_attr = input_tag.get("id", "")
    m = re.fullmatch(r"q(\d{1,2})", qid_attr)
    return int(m.group(1)) if m else None


def _is_question_element(el: Any) -> bool:
    """True if el is a <select>/<input> with id matching q\\d+."""
    if not isinstance(el, Tag) or el.name not in ("select", "input"):
        return False
    return bool(re.fullmatch(r"q\d{1,2}", el.get("id", "")))


def _walk_text_until_next_question(node: Tag, max_chars: int = 600) -> tuple[str, str]:
    """
    Like _walk_text_around but STOPS at the next/previous question element.
    Handles the case where two inputs share a single <li>:

        <li>... incorporated <input id=q8> and colours ... in the <input id=q9> ...</li>

    For q8: before="incorporated", after="and colours ..." (stop before q9)
    For q9: before="in the", after="..."
    """
    before_parts: list[str] = []
    after_parts: list[str] = []
    parent = node.parent
    if parent is None:
        return "", ""

    children = list(parent.children)
    try:
        idx = children.index(node)
    except ValueError:
        return "", ""

    # BEFORE: walk leftward from node-1 until we hit a question element or run out
    for sib in reversed(children[:idx]):
        if _is_question_element(sib):
            break
        if isinstance(sib, NavigableString):
            before_parts.append(str(sib))
        elif isinstance(sib, Tag):
            if sib.name in ("br", "hr"):
                continue
            if sib.name == "b" and _Q_NUMBER_PATTERN.match(sib.get_text() or ""):
                # The bold question number marker — skip
                continue
            before_parts.append(sib.get_text(" "))
    before_parts.reverse()

    # AFTER: walk rightward from node+1 until we hit a question element
    for sib in children[idx + 1:]:
        if _is_question_element(sib):
            break
        if isinstance(sib, NavigableString):
            after_parts.append(str(sib))
        elif isinstance(sib, Tag):
            if sib.name in ("br", "hr"):
                continue
            if sib.name == "b" and _Q_NUMBER_PATTERN.match(sib.get_text() or ""):
                continue
            after_parts.append(sib.get_text(" "))

    before = _clean_text(" ".join(before_parts))[-max_chars:]
    after = _clean_text(" ".join(after_parts))[:max_chars]

    # Strip a stray leading question number like "1 " or "13 "
    before = re.sub(r"^\d{1,2}\s+", "", before).strip()
    return before, after


def _walk_text_around(node: Tag, max_chars: int = 600) -> tuple[str, str]:
    """
    Given a <select> or <input> node, return (text_before, text_after) — used
    to build the question stem from surrounding text. We walk sibling text
    nodes and stop at structural boundaries.
    """
    before_parts: list[str] = []
    after_parts: list[str] = []

    # Walk previous siblings of the question element's parent <p>
    parent_p = node.find_parent("p") or node
    # Text BEFORE the element within the same <p>
    for sib in node.parent.children if node.parent else []:
        if sib is node:
            break
        if isinstance(sib, NavigableString):
            before_parts.append(str(sib))
        elif isinstance(sib, Tag):
            # Skip <b>N </b> markers (they're the question number) and the toolbar
            if sib.name == "b":
                continue
            before_parts.append(sib.get_text(" "))
    # Text AFTER within the same <p>
    seen = False
    for sib in node.parent.children if node.parent else []:
        if sib is node:
            seen = True
            continue
        if not seen:
            continue
        if isinstance(sib, NavigableString):
            after_parts.append(str(sib))
        elif isinstance(sib, Tag):
            after_parts.append(sib.get_text(" "))

    before = _clean_text(" ".join(before_parts))[-max_chars:]
    after = _clean_text(" ".join(after_parts))[:max_chars]

    # Strip a leading single number ("1 ", "13 ") which is the question marker
    # that <b>N </b> already rendered as whitespace text in some sites.
    before = re.sub(r"^\d{1,2}\s+", "", before).strip()
    _ = parent_p
    return before, after


def _build_stem(before: str, after: str) -> str:
    """
    Combine before+after into a coherent question stem. For TFNG-style the
    stem is in `after`. For completion-style we render the cloze as
    "<before> ____ <after>" so the student sees the gap context.
    """
    before = before.strip()
    after = after.strip()
    if before and after:
        # Cloze: "Aboriginal art incorporated ____ and colours" etc.
        return f"{before} _____ {after}"
    return after or before


def _extract_group(section_div: Tag) -> MIGroup | None:
    """Parse one <div class="exam-section"> into a MIGroup."""
    h2 = section_div.select_one("h2")
    if h2 is None:
        return None
    range_label = _clean_text(h2.get_text())
    if not range_label.lower().startswith("questions"):
        return None

    # Drop the H2 from further processing so its text doesn't leak into instruction
    h2.decompose()

    # Drop workspace controls and ads
    for node in section_div.select(".workspace, .collapse, .ads, script, style"):
        node.decompose()

    questions: list[MIQuestion] = []
    instruction_parts: list[str] = []

    # First pass — collect instruction text from <p>/<li> that come BEFORE
    # the first question element. Once we hit the first question element,
    # stop collecting instruction text.
    first_q_seen = False
    for el in section_div.select("p, li"):
        if el.find("select", id=re.compile(r"^q\d+$")) or el.find("input", id=re.compile(r"^q\d+$")):
            first_q_seen = True
            break
        if not first_q_seen:
            text = _clean_text(el.get_text(" ", strip=True))
            if text:
                instruction_parts.append(text)

    # Second pass — iterate over ALL question elements directly. Two inputs
    # can share a single <li> (e.g. cloze with "incorporated <q8> and colours
    # ... in the <q9> she gave her artworks") — so iterate by element, not
    # by container.
    question_elements = section_div.find_all(
        ["select", "input"],
        id=re.compile(r"^q\d+$"),
    )
    for el in question_elements:
        if el.name == "select":
            parsed = _extract_select_question(el)
            if parsed is None:
                continue
            qid, options = parsed
            _, after = _walk_text_until_next_question(el)
            stem = _build_stem("", after)
            questions.append(MIQuestion(
                qid=qid,
                question_text=stem,
                options=options,
                kind="mcq",  # refined below
            ))
        else:
            qid = _extract_input_question_id(el)
            if qid is None:
                continue
            before, after = _walk_text_until_next_question(el)
            stem = _build_stem(before, after)
            questions.append(MIQuestion(
                qid=qid,
                question_text=stem,
                options=None,
                kind="completion",
            ))

    if not questions:
        return None

    instruction = " ".join(instruction_parts).strip()
    # Refine the kind for the whole group using the joined instruction
    options_present = any(q.options for q in questions)
    qtype = _detect_kind(instruction, options_present)
    for q in questions:
        # MCQ-with-options stays mcq; refine TFNG / matching
        if q.options:
            q.kind = qtype if qtype in ("tfng", "matching", "mcq") else "mcq"
        else:
            q.kind = qtype if qtype == "matching" else "completion"

    return MIGroup(
        range_label=range_label,
        instruction=instruction,
        question_type=qtype,
        questions=sorted(questions, key=lambda q: q.qid),
    )


# ─── Top-level entry point ──────────────────────────────────────────────────

def parse_reading_test_html(
    html: str,
    *,
    test_id: str = "",
    slug: str = "",
) -> MIReadingTest:
    """Parse one mini-ielts.com reading-test page into MIReadingTest."""
    soup = BeautifulSoup(html, "html.parser")
    title, passage = _extract_passage(soup)

    groups: list[MIGroup] = []
    for section in soup.select("div.exam-section"):
        group = _extract_group(section)
        if group is not None:
            groups.append(group)

    return MIReadingTest(
        test_id=test_id,
        slug=slug,
        title=title,
        passage_text=passage,
        groups=groups,
    )


# ─── JSON projection ────────────────────────────────────────────────────────

def to_dict(test: MIReadingTest) -> dict[str, Any]:
    return {
        "test_id": test.test_id,
        "slug": test.slug,
        "title": test.title,
        "passage_text": test.passage_text,
        "total_questions": test.total_questions,
        "groups": [
            {
                "range_label": g.range_label,
                "instruction": g.instruction,
                "question_type": g.question_type,
                "questions": [
                    {
                        "qid": q.qid,
                        "question_text": q.question_text,
                        "options": q.options,
                        "kind": q.kind,
                    }
                    for q in g.questions
                ],
            }
            for g in test.groups
        ],
    }
