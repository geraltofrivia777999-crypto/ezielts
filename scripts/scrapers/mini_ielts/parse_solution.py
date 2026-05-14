"""
mini-ielts.com solution-page HTML parser.

Extracts {qid: correct_answer} from a /view-solution/... page. Answers
appear as `<span class="answer">Answer: TRUE</span>` immediately after
each question element.
"""
from __future__ import annotations

import re
from bs4 import BeautifulSoup, Tag


_ANSWER_PREFIX = re.compile(r"^\s*Answer\s*:?\s*", re.I)


def parse_solution_html(html: str) -> dict[int, str]:
    """
    Parse a mini-ielts solution page → dict mapping question-id to answer.

    The answer appears as:
      <span class="answer">Answer: TRUE</span>
    immediately after the question's <select>/<input> element. We walk
    each <span class="answer"> and look upward for the nearest q-id element
    inside the same <p>/<li> container.
    """
    soup = BeautifulSoup(html, "html.parser")
    answers: dict[int, str] = {}

    for span in soup.select("span.answer"):
        raw = span.get_text(" ", strip=True)
        # Strip the "Answer: " prefix
        ans = _ANSWER_PREFIX.sub("", raw).strip()
        if not ans:
            continue

        qid = _find_nearest_qid(span)
        if qid is None:
            continue
        # If the same qid appears twice (shouldn't normally), keep the first
        if qid not in answers:
            answers[qid] = ans

    return answers


def _find_nearest_qid(span: Tag) -> int | None:
    """
    Find the question-id of the question this answer belongs to.

    Strategy: walk BACKWARD from the answer span in document order until we
    hit a <select id='qN'> or <input id='qN'>. That's the question the
    answer applies to. This correctly handles two questions sharing the
    same <li>:

        <li>... <input id=q8> <span class="answer">Answer: symbols</span>
                ... <input id=q9> <span class="answer">Answer: titles</span> ...</li>

    The "first preceding" rule pairs q8↔symbols and q9↔titles.
    """
    # find_all_previous iterates over nodes BEFORE `span` in document order
    for el in span.find_all_previous(["select", "input"]):
        qid_attr = el.get("id", "")
        m = re.fullmatch(r"q(\d{1,2})", qid_attr)
        if m:
            return int(m.group(1))
    return None
