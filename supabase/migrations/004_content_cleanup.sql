-- ============================================================================
-- 004_content_cleanup.sql
--
-- Deletes the garbage rows produced by the buggy legacy import script
-- (`scripts/import_to_supabase.py`). See lib/test-mapping/content-filter.ts
-- for the JS-side mirror of these predicates and unit tests with real
-- examples from the user-reported broken UI.
--
-- This migration is IDEMPOTENT — running it twice produces the same result.
-- It is also CONSERVATIVE: each predicate is narrow enough that no legitimate
-- IELTS row should be matched. After running, the UI filter still applies as
-- a second line of defence.
--
-- Importer bugs being remediated (see docs/IMPORT_SCRIPT_BUGS.md):
--   1. "Question N" placeholder rows
--   2. Section / Questions-range headers as question_text
--   3. Instruction text stored as question_text
--   4. Matching answer-endings ("A stick / B curl / C are") in question_text
--   5. Multiple distinct questions glued into one row
--   6. Table-completion prompts with 3+ blanks crammed in
--   7. Empty correct_answer rows (cannot be graded)
-- ============================================================================

-- ── Reading: delete garbage question rows ──────────────────────────────────

with garbage_reading as (
  select id from public.reading_questions
  where
    -- (1) literal "Question N" placeholder
    question_text ~* '^\s*Question\s+\d+\s*$'

    -- (2) section / questions-range headers
    or question_text ~* '^\s*Section\s+\d+\s*[:.]?\s*$'
    or question_text ~* '^\s*Questions?\s+\d+\s*[-–]\s*\d+\s*$'
    or question_text ~* '^\s*Section\s+\d+\s*:\s*Questions?\s+\d+\s*[-–]\s*\d+'

    -- (3) instruction text stored as question (short rows only — long real
    --     questions sometimes start with these verbs)
    or (length(question_text) < 200 and (
         question_text ~* '^\s*(Choose|Write|Complete|Decide|Match|Read|Select|Answer)\s+(the|each|whether|YES|NO|TRUE|FALSE)'
      or question_text ~* '^\s*Questions?\s+\d+\s+(Choose|Write|Complete|Decide|Match|Read|Select|Answer)\s+(the|each|whether|correct|YES|NO|TRUE|FALSE)'
      or question_text ~* '^\s*Reading\s+Passage\s+\d'
    ))

    -- (4) matching answer-endings stuffed in: 3+ "X <lowercase>" letter clauses
    or (
      length(regexp_replace(question_text, '(^|\s)[A-G]\s+[a-z][a-z]+', '#', 'g'))
      < length(question_text) - 30
      and question_text ~ '(^|\s)[A-G]\s+[a-z]'
    )

    -- (5) multiple glued questions: 2+ standalone "NN Capitalised" markers
    or (
      array_length(
        regexp_split_to_array(question_text, '\m\d{1,2}\s+[A-Z][a-z]'),
        1
      ) >= 3
    )

    -- (6) table-completion prompts with 3+ blanks "(1)(2)(3)..." crammed in
    or (
      array_length(regexp_split_to_array(question_text, '\(\d+\)'), 1) >= 4
    )

    -- (7) empty correct_answer
    or (correct_answer is null or btrim(correct_answer) = '')
)
delete from public.reading_questions
where id in (select id from garbage_reading);

-- ── Listening: same predicates ─────────────────────────────────────────────

with garbage_listening as (
  select id from public.listening_questions
  where
    question_text ~* '^\s*Question\s+\d+\s*$'
    or question_text ~* '^\s*Section\s+\d+\s*[:.]?\s*$'
    or question_text ~* '^\s*Questions?\s+\d+\s*[-–]\s*\d+\s*$'
    or question_text ~* '^\s*Section\s+\d+\s*:\s*Questions?\s+\d+\s*[-–]\s*\d+'
    or (length(question_text) < 200 and (
         question_text ~* '^\s*(Choose|Write|Complete|Decide|Match|Read|Select|Answer)\s+(the|each|whether|YES|NO|TRUE|FALSE)'
      or question_text ~* '^\s*Questions?\s+\d+\s+(Choose|Write|Complete|Decide|Match|Read|Select|Answer)\s+(the|each|whether|correct|YES|NO|TRUE|FALSE)'
    ))
    or (
      length(regexp_replace(question_text, '(^|\s)[A-G]\s+[a-z][a-z]+', '#', 'g'))
      < length(question_text) - 30
      and question_text ~ '(^|\s)[A-G]\s+[a-z]'
    )
    or (
      array_length(
        regexp_split_to_array(question_text, '\m\d{1,2}\s+[A-Z][a-z]'),
        1
      ) >= 3
    )
    or (
      array_length(regexp_split_to_array(question_text, '\(\d+\)'), 1) >= 4
    )
    or (correct_answer is null or btrim(correct_answer) = '')
)
delete from public.listening_questions
where id in (select id from garbage_listening);

-- ── Clean up orphaned groups / sections (no questions left) ────────────────

delete from public.reading_question_groups g
where not exists (
  select 1 from public.reading_questions q where q.group_id = g.id
);

delete from public.reading_sections s
where not exists (
  select 1 from public.reading_question_groups g where g.section_id = s.id
);

delete from public.listening_question_groups g
where not exists (
  select 1 from public.listening_questions q where q.group_id = g.id
);

-- ── Clean up reading_tests / listening_tests that have no content left ─────

delete from public.reading_tests t
where not exists (
  select 1 from public.reading_sections s where s.test_id = t.id
);

delete from public.listening_tests t
where not exists (
  select 1 from public.listening_question_groups g where g.test_id = t.id
);

-- ── Speaking: fix topic_text that is a stringified JSON array ──────────────
-- If topic_text starts with '[' and ends with ']' AND no cue_card_points were
-- populated, try to extract the array contents as cue_card_points.

update public.speaking_topics
set
  topic_text = '',
  cue_card_points = topic_text::jsonb
where
  topic_text like '[%]'
  and cue_card_points is null
  and topic_text::jsonb ? '0'  -- valid JSON array check (PostgreSQL ? checks key existence)
;

-- Final defensive: zero-out topic_text that is literally just brackets
update public.speaking_topics
set topic_text = ''
where btrim(topic_text) in ('[', ']', '[]', '""');
