# Import Script Bug Report — `scripts/import_to_supabase.py`

The legacy importer produced the broken content visible in the user-reported
screenshots (literal "Question N" rows, instructions stored as questions,
4 questions glued into one row, etc.). This document catalogues each bug,
links to the exact lines, and lays out a concrete rewrite plan.

The temporary mitigations already in place are:

1. **`lib/test-mapping/content-filter.ts`** — UI-side filter that hides
   garbage rows before they reach React. Unit-tested with the actual bad
   strings from the screenshots.
2. **`supabase/migrations/004_content_cleanup.sql`** — DB-side `DELETE`
   migration that removes the same garbage rows permanently.
3. **`supabase/migrations/005_curated_seed.sql`** — hand-written clean
   content (1 Reading + 2 Writing + 3 Speaking) as a guaranteed-working
   baseline.

Once the importer is fixed and re-run, the filter will continue to act as a
defence-in-depth layer.

---

## The bugs

### Reading — `import_reading()` (lines 147–279)

#### Bug 1 — Question groups are duplicated per passage

```python
for pi, passage in enumerate(passages):
    ...
    qgroups = item.get("question_groups") or []   # line 224 — INSIDE passage loop
    for gi, qg in enumerate(qgroups):
        ...                                        # creates a new group ROW per passage
```

`question_groups` are read inside the passage loop, so every group (and every
question in it) is **re-inserted once per passage**. A test with 3 passages
and 4 groups ends up with **12 groups** in the database; the same questions
appear 3 times each, attached to different `reading_sections`.

This is why the Reading screenshot shows "Questions 19-22" five separate
times in the same passage.

**Fix:** move `qgroups` extraction outside the passage loop, and assign each
group to its correct passage using the question-number range (`q_start..q_end`
vs. each passage's question count).

#### Bug 2 — `q_texts` flattens ALL blocks into one list

```python
blocks = qg.get("blocks") or []
q_texts = []
for blk in blocks:
    t = strip_html(blk.get("text") or "")
    if t:
        q_texts.append(t)
```

The JSON source organises `blocks` heterogeneously: some blocks are
**instructions** (group headers), some are **question stems**, some are
**option labels** (`A. … B. … C. …`), some are **matching endings**
(`A stick … B curl …`). They are all dumped into one flat list.

#### Bug 3 — Question text mapped by index into the flat list

```python
q_text = q_texts[qnum - q_start] if (qnum - q_start) < len(q_texts) else f"Question {qnum}"
```

The code then assumes `q_texts[N]` corresponds to question number `N`. But
because of Bug 2, `q_texts[N]` is more likely to be an instruction or an
option than the actual question. Every question therefore receives **the
wrong text** with high probability.

The Reading screenshot row `"23 Insect feet lose ... 24 If you put ... 25 Beetles ..."`
is what happens when `q_texts[0]` is actually a paragraph containing four
question-number markers glued together.

#### Bug 4 — `"Question N"` fallback stored as real question text

```python
... else f"Question {qnum}"
```

When `q_texts` runs short (very common), the literal string `"Question 4"` is
inserted into `reading_questions.question_text`. The user sees rows that say
just "Question 4" in the UI.

#### Bug 5 — Group-wide options applied to every question

```python
opts = [b for b in q_texts if len(b) < 200 and b[0:2] in ("A.","B.","C.","D.")]
if opts:
    options = opts
```

All A/B/C/D-prefixed blocks **anywhere in the group** are collected into a
single `options` list and written to **every question in the group**. So if
question 1's options are `[A1, B1, C1, D1]` and question 2's are
`[A2, B2, C2, D2]`, both questions end up with `[A1, B1, C1, D1, A2, B2, C2, D2]`.

#### Bug 6 — `correct_answer` is force-uppercased

```python
"correct_answer": str(correct).upper(),
```

For MCQ/TFNG answers this is fine (`"B"`, `"TRUE"`). For completion answers
it destroys the original casing: `"anchoring"` becomes `"ANCHORING"`. The
UI matcher in `matchesText()` is case-insensitive so grading still works,
but the **review screen shows the wrong casing to the student**.

---

### Listening — `import_listening()` (lines 283–367)

Bugs 2 through 6 are present verbatim. Bug 1 does not apply because
listening tests have a single `test_id` rather than multiple sections —
but the structural fix in Bug 2 is identical.

---

### Speaking — `import_speaking()` (lines 432–487)

#### Bug 7 — `cue_card_points` is always `null`

```python
"cue_card_points": json.dumps(None),     # line 465 — ALWAYS None
```

Despite Part 2 cue cards being the most important Speaking content, every
row has `cue_card_points = null`. The UI then falls back to fallback
constants.

#### Bug 8 — Stringified JSON arrays stored as plain `topic_text`

The source `cue_card_text` field is sometimes a JSON-stringified array
(`'["What the book was about","Why you read it"]'`). The importer runs
`strip_html` on it but **never parses the JSON**. The resulting cell
contains a literal `[` as the first character, producing the speaking
screenshot's empty-bracket cue card.

**Fix:** before storing, attempt `json.loads(cue_card_text)` — if it
returns a list of strings, store the **first element** as `topic_text`
and the rest as `cue_card_points`. Otherwise treat it as plain text.

---

## Rewrite plan (suggested order)

1. **Snapshot the source JSON shape.** Before changing the script, dump 5
   `reading` items and 5 `listening` items with `json.dumps(item, indent=2)`
   so the new logic can be tested locally.

2. **Extract a `parse_question_group(qg, answers_map)` function** that
   returns a list of `{question_text, options, correct_answer}` dicts.
   This is the unit to unit-test. The function should:
   - Walk `blocks` and classify each one (instruction vs question vs
     option-label vs matching-ending) by content heuristic.
   - Pair question-stems with their option-labels by position.
   - Return one dict per question in `q_start..q_end`, never falling back
     to `"Question N"`.

3. **Move `question_groups` extraction OUT of the passage loop** and assign
   each group to a passage via question-number range.

4. **Stop uppercasing free-text `correct_answer`** — keep original casing
   for completion/short-answer questions. Only uppercase A/B/C/D and
   TRUE/FALSE/NOT GIVEN.

5. **Parse `cue_card_text` as JSON before storing**, and populate
   `cue_card_points` properly.

6. **Add a dry-run validator** that runs the new `content-filter.ts`
   predicates (mirrored in Python) against every row before INSERT, and
   refuses to write rows that fail.

7. **Re-run import.** The DB cleanup migration (`004`) will have removed
   the legacy garbage; the new content will replace it via `external_id`
   conflict.

---

## Tests to add when rewriting (Python)

Place these in `scripts/tests/test_import.py`:

- `test_parse_question_group_separates_instruction_from_question`
- `test_parse_question_group_pairs_options_to_correct_question`
- `test_parse_question_group_handles_matching_endings_as_options_not_text`
- `test_parse_question_group_returns_empty_list_when_blocks_malformed`
  (instead of falling back to "Question N")
- `test_cue_card_text_json_array_split_into_topic_text_and_points`
- `test_correct_answer_preserves_casing_for_completion`
- `test_correct_answer_uppercases_letter_and_tfng`
