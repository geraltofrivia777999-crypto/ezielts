"""
ieltszen — Clean Reading-test parser.
====================================

Pure, side-effect-free conversion from a single
`practicepteonline_reading.json` item into the schema expected by the
Supabase tables `reading_tests` / `reading_sections` /
`reading_question_groups` / `reading_questions`.

Why a separate parser:
  the legacy `import_to_supabase.py` had at least six bugs that produced
  the garbage rows visible in the user-reported broken UI (see
  `docs/IMPORT_SCRIPT_BUGS.md`). This module replaces the bug-ridden
  parsing logic; the importer is then a thin shim that calls the parser
  and writes the result.

What the parser does NOT do:
  - touch the database
  - perform HTTP requests
  - require environment variables

This means it can be exhaustively unit-tested against real JSON
samples (see `scripts/tests/test_parse_reading.py`).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Iterable


# ── Data classes (mirror the Supabase schema) ───────────────────────────────


@dataclass
class ParsedQuestion:
    question_text: str
    options: list[str] | None  # JSON-stringified by the importer
    correct_answer: str         # original casing preserved
    sort_order: int             # = question number from the source


@dataclass
class ParsedGroup:
    instruction: str
    question_type: str          # 'mcq' | 'tfng' | 'matching' | 'completion' | 'short_answer'
    sort_order: int
    questions: list[ParsedQuestion] = field(default_factory=list)
    range_start: int = 0
    range_end: int = 0


@dataclass
class ParsedPassage:
    part_number: int
    passage_text: str
    groups: list[ParsedGroup] = field(default_factory=list)


@dataclass
class ParsedReadingTest:
    external_id: str
    title: str
    category: str               # 'academic' | 'general'
    passages: list[ParsedPassage] = field(default_factory=list)


# ── HTML / whitespace helpers ───────────────────────────────────────────────


_HTML_TAG = re.compile(r"<[^>]+>")
_HTML_ENTITIES = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
    "&#8217;": "'", "&#8216;": "'", "&#8220;": '"', "&#8221;": '"',
    "&ldquo;": '"', "&rdquo;": '"', "&quot;": '"',
}


def strip_html(text: str | None) -> str:
    if not text:
        return ""
    t = _HTML_TAG.sub(" ", text)
    for ent, repl in _HTML_ENTITIES.items():
        t = t.replace(ent, repl)
    return re.sub(r"\s+", " ", t).strip()


# ── Question-type detection ─────────────────────────────────────────────────


def detect_question_type(instruction: str) -> str:
    inst = instruction.lower()
    # Order matters — most specific patterns first.
    if "yes" in inst and "no" in inst and "not given" in inst:
        return "tfng"   # we treat Y/N/NG as the tfng family in the DB
    if "true" in inst and "false" in inst and "not given" in inst:
        return "tfng"
    if "match" in inst and ("heading" in inst or "headings" in inst):
        return "matching"
    if "match" in inst:
        return "matching"
    if "complete the summary" in inst or ("summary" in inst and "complete" in inst):
        return "completion"
    if "complete" in inst or "fill in" in inst:
        return "completion"
    if "short answer" in inst or "answer the question" in inst:
        return "short_answer"
    if "choose" in inst and "letter" in inst:
        return "mcq"
    if "choose" in inst or "multiple choice" in inst:
        return "mcq"
    return "mcq"  # safe default


# ── Block helpers ────────────────────────────────────────────────────────────


def _block_texts(blocks: Any) -> list[str]:
    """Extract clean text from a list-of-dicts (or list-of-strings) of blocks."""
    out: list[str] = []
    if not isinstance(blocks, list):
        return out
    for b in blocks:
        if isinstance(b, dict):
            t = strip_html(b.get("text") or "")
        else:
            t = strip_html(str(b))
        if t:
            out.append(t)
    return out


# Match a question-number marker that starts a question stem: "12 Word" or "1. Word".
# Bounded so that "10,000" inside text doesn't trigger a split.
_Q_NUMBER_MARKER = re.compile(r"(?:^|\s)(\d{1,2})\s+(?=[A-Z(])")


def _split_glued_questions(text: str, start: int, end: int) -> dict[int, str]:
    """
    Split a string like "1 First Q? 2 Second Q? 3 Third Q?" into
    {1: 'First Q?', 2: 'Second Q?', 3: 'Third Q?'}.

    Only returns entries whose key is in [start, end].
    """
    if not text:
        return {}
    # Find positions of each numbered marker
    matches = list(_Q_NUMBER_MARKER.finditer(text))
    out: dict[int, str] = {}
    for i, m in enumerate(matches):
        try:
            num = int(m.group(1))
        except ValueError:
            continue
        if not (start <= num <= end):
            continue
        text_start = m.end()
        text_end = matches[i + 1].start() if (i + 1) < len(matches) else len(text)
        chunk = text[text_start:text_end].strip()
        # Strip leading dot if the source used "1." style
        if chunk.startswith(". "):
            chunk = chunk[2:].lstrip()
        if chunk:
            out[num] = chunk
    return out


# Match an option label inside a "List of …" or option-string block.
# Matches "A Foo B Bar C Baz" → [('A','Foo'),('B','Bar'),('C','Baz')]
_OPTION_LABEL = re.compile(r"(?:^|\s)([A-J])\b(?:\.|:)?\s+")


def _parse_option_list(text: str) -> list[str]:
    """Split 'A foo B bar C baz' into ['foo','bar','baz']."""
    if not text:
        return []
    matches = list(_OPTION_LABEL.finditer(text))
    if not matches:
        return []
    out: list[str] = []
    for i, m in enumerate(matches):
        text_start = m.end()
        text_end = matches[i + 1].start() if (i + 1) < len(matches) else len(text)
        chunk = text[text_start:text_end].strip().rstrip(",.;")
        if chunk:
            out.append(chunk)
    return out


def _normalise_answer(raw: Any) -> str:
    """Preserve casing for free-text answers; only uppercase letter/TFNG."""
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    # Single letter A-J → uppercase
    if re.fullmatch(r"[A-Ja-j]", s):
        return s.upper()
    # TFNG / YNNG family → uppercase
    if s.lower() in {"true", "false", "not given", "yes", "no"}:
        return s.upper()
    # Free-text (e.g. "anchoring") → preserve original casing
    return s


# ── Per-group parsers ────────────────────────────────────────────────────────


def _parse_group_tfng(
    group: dict[str, Any],
    answers: dict[str, Any],
    options: list[str],
) -> list[ParsedQuestion]:
    """TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN groups."""
    start = int(group["range"]["start"])
    end = int(group["range"]["end"])
    blocks = _block_texts(group.get("blocks") or [])

    # The "questions" block is the one starting with "<number> Capitalised"
    questions_text = ""
    for b in blocks:
        if _Q_NUMBER_MARKER.search(" " + b):
            questions_text = b
            break

    split = _split_glued_questions(questions_text, start, end)
    out: list[ParsedQuestion] = []
    for qnum in range(start, end + 1):
        text = split.get(qnum)
        if not text:
            continue  # skip rather than create a "Question N" placeholder
        correct = _normalise_answer(answers.get(str(qnum)))
        if not correct:
            continue
        out.append(ParsedQuestion(
            question_text=text,
            options=options,
            correct_answer=correct,
            sort_order=qnum,
        ))
    return out


def _parse_group_matching(
    group: dict[str, Any],
    answers: dict[str, Any],
) -> list[ParsedQuestion]:
    """Matching: statements get glued in one block, options in another."""
    start = int(group["range"]["start"])
    end = int(group["range"]["end"])
    blocks = _block_texts(group.get("blocks") or [])

    # Find the block that splits cleanly into options ("A foo B bar C baz")
    options: list[str] = []
    for b in reversed(blocks):  # options block is usually last
        candidate = _parse_option_list(b)
        if len(candidate) >= 2:
            options = candidate
            break

    # Find the questions block: contains numbered markers
    questions_text = ""
    for b in blocks:
        if _Q_NUMBER_MARKER.search(" " + b):
            questions_text = b
            break

    split = _split_glued_questions(questions_text, start, end)
    out: list[ParsedQuestion] = []
    for qnum in range(start, end + 1):
        text = split.get(qnum)
        correct = _normalise_answer(answers.get(str(qnum)))
        if not text or not correct:
            continue
        out.append(ParsedQuestion(
            question_text=text,
            options=options if options else None,
            correct_answer=correct,
            sort_order=qnum,
        ))
    return out


def _parse_group_mcq(
    group: dict[str, Any],
    answers: dict[str, Any],
) -> list[ParsedQuestion]:
    """Single-question MCQ: blocks are usually [question_stem, "A foo B bar C baz D qux"]."""
    start = int(group["range"]["start"])
    end = int(group["range"]["end"])
    blocks = _block_texts(group.get("blocks") or [])
    # Drop the instruction block if it's the first one (already in `instruction` field)
    inst = strip_html(group.get("instruction", ""))
    blocks = [b for b in blocks if b != inst]

    # Find the options block (parseable into ≥2 A/B/C labels)
    options: list[str] = []
    options_idx = -1
    for i, b in enumerate(reversed(blocks)):
        candidate = _parse_option_list(b)
        if len(candidate) >= 2:
            options = candidate
            options_idx = len(blocks) - 1 - i
            break

    out: list[ParsedQuestion] = []

    # Single-question case: question stem is the block before options
    if start == end:
        stem = ""
        for i, b in enumerate(blocks):
            if i == options_idx:
                continue
            if _Q_NUMBER_MARKER.search(" " + b):
                # Stem with question-number prefix → strip the marker
                m = _Q_NUMBER_MARKER.search(" " + b)
                if m:
                    stem = b[m.end() - 1:].strip()
                    break
            # Otherwise, take the first non-options non-empty block as stem
            if not stem:
                stem = b
        correct = _normalise_answer(answers.get(str(start)))
        if stem and correct:
            out.append(ParsedQuestion(
                question_text=stem,
                options=options or None,
                correct_answer=correct,
                sort_order=start,
            ))
        return out

    # Multi-question case: stems are glued, "1 stem1 2 stem2 3 stem3"
    # Options if present are usually shared across all questions.
    questions_text = ""
    for i, b in enumerate(blocks):
        if i == options_idx:
            continue
        if _Q_NUMBER_MARKER.search(" " + b):
            questions_text = b
            break
    split = _split_glued_questions(questions_text, start, end)
    for qnum in range(start, end + 1):
        stem = split.get(qnum)
        correct = _normalise_answer(answers.get(str(qnum)))
        if not stem or not correct:
            continue
        out.append(ParsedQuestion(
            question_text=stem,
            options=options or None,
            correct_answer=correct,
            sort_order=qnum,
        ))
    return out


def _parse_group_completion(
    group: dict[str, Any],
    answers: dict[str, Any],
) -> list[ParsedQuestion]:
    """Summary/sentence completion and form-completion.

    Two sub-shapes appear in the source:

    A) **True cloze:** a paragraph with `(1) ____ … (2) ____ …` blanks.
       Optionally accompanied by a word-bank "A foo B bar C baz".

    B) **Numbered short-answer list** disguised as "Complete the form":
       block contains `1 Question text? 2 Next question? 3 …`. These should
       be split into individual short-answer rows, not lumped into one cloze.
    """
    start = int(group["range"]["start"])
    end = int(group["range"]["end"])
    blocks = _block_texts(group.get("blocks") or [])
    inst = strip_html(group.get("instruction", ""))

    # Substring filter — drop blocks that look like the instruction
    def _is_instruction_block(b: str) -> bool:
        if b == inst:
            return True
        if inst and inst in b and len(b) < len(inst) + 30:
            return True
        if len(b) < 200 and re.match(
            r"^\s*(?:Choose|Write|Complete|Decide|Match|Read|Select|Answer)\s+(?:the|each|whether|YES|NO|TRUE|FALSE)",
            b, re.I
        ):
            return True
        return False

    blocks = [b for b in blocks if not _is_instruction_block(b)]

    # Try to find a word-bank options block ("A foo B bar C baz")
    options: list[str] = []
    word_bank_idx = -1
    for i, b in enumerate(blocks):
        candidate = _parse_option_list(b)
        if len(candidate) >= 4 and all(len(o) < 80 for o in candidate):
            options = candidate
            word_bank_idx = i
            break

    # Look for a "numbered short-answer list" block first — handles case (B)
    numbered_block = ""
    for i, b in enumerate(blocks):
        if i == word_bank_idx:
            continue
        # 2+ question-number markers AND no cloze-style "(N)" blanks
        markers = list(_Q_NUMBER_MARKER.finditer(" " + b))
        cloze_markers = re.findall(r"\(\d+\)", b)
        if len(markers) >= 2 and len(cloze_markers) < 2:
            numbered_block = b
            break

    if numbered_block:
        # Case B → split into individual short-answer rows
        split = _split_glued_questions(numbered_block, start, end)
        out: list[ParsedQuestion] = []
        for qnum in range(start, end + 1):
            text = split.get(qnum)
            correct = _normalise_answer(answers.get(str(qnum)))
            if not text or not correct:
                continue
            out.append(ParsedQuestion(
                question_text=text,
                options=options or None,
                correct_answer=correct,
                sort_order=qnum,
            ))
        return out

    # Case A → true cloze with `(N)` blanks
    cloze_text = ""
    for i, b in enumerate(blocks):
        if i == word_bank_idx:
            continue
        if len(re.findall(r"\(\d+\)", b)) >= 2:
            cloze_text = b
            break

    # Last-resort fallback: longest remaining block, but ONLY if it's the
    # main passage-style block (not an instruction). If even this fails we
    # skip the group entirely — better to emit nothing than garbage.
    if not cloze_text:
        non_opt = [b for i, b in enumerate(blocks) if i != word_bank_idx]
        non_opt = [b for b in non_opt if len(b) > 100]  # require substantial text
        if non_opt:
            cloze_text = max(non_opt, key=len)

    if not cloze_text:
        return []  # cannot extract cleanly → skip

    out_a: list[ParsedQuestion] = []
    for qnum in range(start, end + 1):
        correct = _normalise_answer(answers.get(str(qnum)))
        if not correct:
            continue
        q_label = f"Gap ({qnum}) in:  {cloze_text}"[:2000]
        out_a.append(ParsedQuestion(
            question_text=q_label,
            options=options or None,
            correct_answer=correct,
            sort_order=qnum,
        ))
    return out_a


# ── Top-level test parser ────────────────────────────────────────────────────


def parse_reading_test(item: dict[str, Any]) -> ParsedReadingTest | None:
    """Convert one item from practicepteonline_reading.json into clean rows.

    Returns None if the item lacks a usable test (no passages or no answers).
    """
    passages_raw = item.get("passages") or []
    answers = item.get("answers") or {}
    groups_raw = item.get("question_groups") or []

    if not passages_raw or not answers or not groups_raw:
        return None

    external_id = item.get("slug") or str(item.get("wordpress_id") or "")
    if not external_id:
        return None

    category_raw = (item.get("category") or "").lower()
    category = "general" if "general" in category_raw else "academic"
    title = strip_html(item.get("card_title") or item.get("title") or "Reading Test")

    test = ParsedReadingTest(
        external_id=external_id,
        title=title,
        category=category,
    )

    # 1. Build passages
    for pi, p in enumerate(passages_raw):
        passage_text = strip_html(p.get("text") or "")
        if not passage_text:
            continue
        test.passages.append(ParsedPassage(
            part_number=pi + 1,
            passage_text=passage_text,
        ))

    if not test.passages:
        return None

    # 2. Parse groups + assign each group to the correct passage by question-range
    #    The source doesn't tell us which passage owns which range, so we use
    #    a simple heuristic: assume questions are numbered globally 1..N and
    #    each passage covers roughly an equal share, OR — when ranges run
    #    sequentially — we map by ordinal position within the group list,
    #    splitting groups across passages so each passage gets ~equal share.
    n_passages = len(test.passages)
    groups_per_passage = max(1, len(groups_raw) // n_passages)

    for gi, g in enumerate(groups_raw):
        instruction = strip_html(g.get("instruction") or "")
        # The source `instruction` field sometimes holds context text rather
        # than the actual rubric (e.g. "Questions 20 and 21 The discussion of
        # Williams's research…"). To classify correctly we look at the full
        # block text as well.
        all_blocks_text = " ".join(_block_texts(g.get("blocks") or []))
        classifier_text = f"{instruction} {all_blocks_text}"
        qtype = detect_question_type(classifier_text)
        # If the classifier saw "Complete the form/table/notes" AND a letter
        # bank cue ("Write the correct letter A-F" or "List of X"), treat it
        # as a matching/cloze group: answers are letters but the layout is
        # a completion with a separate option list.
        if (re.search(r"complete the (?:form|table|notes|flow)", classifier_text, re.I)
                and re.search(r"\b(?:correct\s+)?letter\b", classifier_text, re.I)):
            qtype = "matching"

        if qtype == "tfng":
            opts = ["YES", "NO", "NOT GIVEN"] if "yes" in instruction.lower() and "no" in instruction.lower() \
                else ["TRUE", "FALSE", "NOT GIVEN"]
            questions = _parse_group_tfng(g, answers, opts)
        elif qtype == "matching":
            questions = _parse_group_matching(g, answers)
        elif qtype == "completion" or qtype == "short_answer":
            questions = _parse_group_completion(g, answers)
        else:  # mcq
            questions = _parse_group_mcq(g, answers)

        if not questions:
            continue

        group = ParsedGroup(
            instruction=instruction,
            question_type=qtype,
            sort_order=gi,
            questions=questions,
            range_start=int(g["range"]["start"]),
            range_end=int(g["range"]["end"]),
        )

        # Assign to passage
        target_passage_idx = min(gi // groups_per_passage, n_passages - 1)
        test.passages[target_passage_idx].groups.append(group)

    # If a passage ended up with zero groups (uneven distribution), redistribute
    for pi, p in enumerate(test.passages):
        if not p.groups and pi > 0:
            # Move the last group of the previous passage here
            prev = test.passages[pi - 1]
            if len(prev.groups) > 1:
                p.groups.append(prev.groups.pop())

    # Filter out passages that ended up totally empty
    test.passages = [p for p in test.passages if p.groups]

    return test if test.passages else None


# ── Pure JSON projection (convenience for the importer) ─────────────────────


def parsed_to_json(test: ParsedReadingTest) -> dict[str, Any]:
    """Project a ParsedReadingTest into a JSON-serializable nested dict."""
    return {
        "external_id": test.external_id,
        "title": test.title,
        "category": test.category,
        "passages": [
            {
                "part_number": p.part_number,
                "passage_text": p.passage_text,
                "groups": [
                    {
                        "instruction": g.instruction,
                        "question_type": g.question_type,
                        "sort_order": g.sort_order,
                        "questions": [
                            {
                                "question_text": q.question_text,
                                "options": q.options,
                                "correct_answer": q.correct_answer,
                                "sort_order": q.sort_order,
                            }
                            for q in g.questions
                        ],
                    }
                    for g in p.groups
                ],
            }
            for p in test.passages
        ],
    }


def parse_reading_file(path: str) -> Iterable[ParsedReadingTest]:
    """Generator yielding parsed tests from a reading JSON file."""
    with open(path) as f:
        data = json.load(f)
    for item in data:
        parsed = parse_reading_test(item)
        if parsed is not None:
            yield parsed
