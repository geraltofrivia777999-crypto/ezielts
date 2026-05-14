-- ============================================================================
-- 005_curated_seed.sql
--
-- A hand-curated, guaranteed-clean seed of IELTS content. Until the legacy
-- import script (`scripts/import_to_supabase.py`) is rewritten, this is the
-- platform's "known good" baseline — every row here is structured exactly
-- as the schema and UI expect.
--
-- Contents:
--   • 1 Academic Reading test: 3 passages, 13 questions total
--   • 2 Writing tasks: 1× Task 1 (Academic), 1× Task 2
--   • 3 Speaking topics: 1 per part (Part 1, 2, 3)
--
-- All content is original / paraphrased — no copyrighted Cambridge material.
-- IDEMPOTENT: re-running the migration replaces child rows cleanly.
--
-- HISTORY:
--   v1: used CTEs + `(VALUES ...) AS q(text, opts, ans, ord)` aliases.
--       PostgreSQL rejected `text` as alias (reserved type) and Supabase
--       SQL editor also failed on a renamed alias variant. This version
--       uses plain INSERT statements wrapped in a DO block — verbose but
--       bulletproof.
-- ============================================================================

-- ── READING TEST ───────────────────────────────────────────────────────────

insert into public.reading_tests (external_id, source, category, title, difficulty)
values ('curated_reading_01', 'curated', 'academic', 'The Science of Sleep', 'medium')
on conflict (external_id) do update set
  source = excluded.source,
  category = excluded.category,
  title = excluded.title,
  difficulty = excluded.difficulty;

-- Wipe child rows so re-running is clean.
delete from public.reading_sections
where test_id = (select id from public.reading_tests where external_id = 'curated_reading_01');

-- All inserts happen in a DO block so we can use locals for the parent IDs.
do $seed$
declare
  v_test_id     uuid;
  v_section_id  uuid;
  v_group_id    uuid;
begin
  select id into v_test_id from public.reading_tests where external_id = 'curated_reading_01';

  -- ─────────────────────────────────────────────────────────────────────────
  -- PASSAGE 1
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.reading_sections (test_id, part_number, passage_text)
  values (v_test_id, 1,
$$Sleep is one of the most fundamental and least understood aspects of human biology. For most of the twentieth century, scientists assumed that sleep was a passive state — a kind of nightly shutdown during which the brain idled in preparation for the next day. Modern neuroscience has overturned this view almost completely. The sleeping brain is now known to be intensely active, cycling through several distinct stages that each play a specific role in memory, learning and physical recovery.

The most striking discovery is the importance of so-called slow-wave sleep, which dominates the early hours of the night. During these stages, neurons fire in synchronised patterns that appear to consolidate information acquired during the day, transferring it from short-term storage in the hippocampus to longer-term networks in the cortex. Experiments have shown that students who sleep after studying retain significantly more than those who stay awake the same length of time. Rapid Eye Movement (REM) sleep, which intensifies later in the night, plays a different role: it integrates new memories with existing knowledge and is closely linked to creative problem-solving.

Despite these findings, modern life is increasingly hostile to good sleep. Artificial light, irregular schedules and the ubiquity of screens have all been shown to disrupt the circadian rhythms that govern sleep timing. The consequences extend far beyond tiredness. Chronic sleep deprivation is now associated with weakened immune function, weight gain, impaired decision-making and a heightened risk of cardiovascular disease.$$)
  returning id into v_section_id;

  -- Group 1: MCQ
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  values (v_section_id, 'Choose the correct letter, A, B, C or D.', 'mcq', 0)
  returning id into v_group_id;

  insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order) values
    (v_group_id,
     'What was the prevailing scientific view of sleep before the late 20th century?',
     '["That it was essential for muscle repair","That it was a passive shutdown of the brain","That it was needed only by mammals","That it was caused by darkness"]'::jsonb,
     'B', 1),
    (v_group_id,
     'According to the passage, slow-wave sleep is most directly responsible for:',
     '["Resolving emotional conflict","Improving physical reflexes","Consolidating recently learned information","Reducing the need for REM sleep"]'::jsonb,
     'C', 2),
    (v_group_id,
     'Which of the following is presented as a consequence of chronic sleep deprivation?',
     '["Improved short-term memory","Heightened cardiovascular risk","Increased empathy","Slower aging"]'::jsonb,
     'B', 3);

  -- Group 2: TFNG
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  values (v_section_id,
          'Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.',
          'tfng', 1)
  returning id into v_group_id;

  insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order) values
    (v_group_id, 'Students who sleep after studying remember more than students who do not.',
     '["TRUE","FALSE","NOT GIVEN"]'::jsonb, 'TRUE', 4),
    (v_group_id, 'REM sleep is the longest phase of the sleep cycle.',
     '["TRUE","FALSE","NOT GIVEN"]'::jsonb, 'NOT GIVEN', 5),
    (v_group_id, 'Artificial light has no effect on circadian rhythms.',
     '["TRUE","FALSE","NOT GIVEN"]'::jsonb, 'FALSE', 6);

  -- ─────────────────────────────────────────────────────────────────────────
  -- PASSAGE 2
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.reading_sections (test_id, part_number, passage_text)
  values (v_test_id, 2,
$$The history of cities is, in many ways, the history of how human beings have negotiated the tension between proximity and privacy. The earliest urban settlements in Mesopotamia and the Indus Valley were dense, walled spaces in which families lived close together for defence and trade. The Greek polis introduced the idea of the public square — the agora — as a space distinct from the household, where citizens could debate, transact and be seen. The Roman city expanded the public realm further, with baths, forums and amphitheatres that brought tens of thousands of strangers into shared spaces.

For much of the medieval period, European cities contracted again. Walls were rebuilt, and most daily life occurred within tight networks of kinship and craft. It was the early modern period, particularly the seventeenth and eighteenth centuries, that produced the recognisably modern city: planned boulevards, public parks, coffeehouses and theatres. These were spaces designed not for survival but for sociability — and, importantly, for being observed by others.

The twentieth century shifted the balance again. The rise of the automobile and the spread of suburbs encouraged a retreat into private space. By mid-century, many North American cities had emptied their downtowns at night, with workers commuting home to detached houses and self-contained yards. Critics such as Jane Jacobs warned that this withdrawal would impoverish urban life, removing the "eyes on the street" that made cities feel safe and alive. Her work helped seed a counter-movement that, decades later, has produced renewed interest in walkable neighbourhoods, mixed-use development and the gentle density of nineteenth-century street grids.$$)
  returning id into v_section_id;

  -- Group: TFNG
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  values (v_section_id,
          'Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.',
          'tfng', 0)
  returning id into v_group_id;

  insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order) values
    (v_group_id, 'The Greek agora was primarily a religious space.',
     '["TRUE","FALSE","NOT GIVEN"]'::jsonb, 'FALSE', 1),
    (v_group_id, 'Roman amphitheatres could hold tens of thousands of people.',
     '["TRUE","FALSE","NOT GIVEN"]'::jsonb, 'TRUE', 2),
    (v_group_id, 'Medieval European cities were larger than Roman cities.',
     '["TRUE","FALSE","NOT GIVEN"]'::jsonb, 'NOT GIVEN', 3),
    (v_group_id, 'Jane Jacobs argued that suburban living improved city life.',
     '["TRUE","FALSE","NOT GIVEN"]'::jsonb, 'FALSE', 4);

  -- ─────────────────────────────────────────────────────────────────────────
  -- PASSAGE 3
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.reading_sections (test_id, part_number, passage_text)
  values (v_test_id, 3,
$$Few inventions have reshaped human society as quickly as the printing press. Before its diffusion across Europe in the second half of the fifteenth century, books were reproduced by hand — a slow, costly process that effectively restricted literacy to clergy and the wealthy. Johannes Gutenberg's combination of movable metal type, an adapted wine-press and a durable oil-based ink reduced the cost of producing a book by perhaps two orders of magnitude within a single generation.

The cultural consequences were profound but not immediate. In the first decades after 1450, printers mostly reproduced the same texts that scribes had copied for centuries — Latin Bibles, classical philosophy, legal commentaries. Innovation in content followed only as the network of presses expanded and as printers began competing for a wider readership. Vernacular literature in French, German and English appeared in growing numbers from the 1480s. Maps, almanacs and scientific treatises followed soon after.

Historians continue to debate the press's role in the Reformation, the Scientific Revolution and the gradual emergence of public opinion. What seems clear is that the technology accelerated existing trends rather than creating them outright. A literate urban class had begun to grow in northern Italy and the Low Countries well before Gutenberg, and the demand for cheap, accessible texts was already considerable. The press met this demand at an extraordinary scale — by 1500, roughly twenty million books were in circulation, in a Europe whose total population was perhaps eighty million.$$)
  returning id into v_section_id;

  -- Group: MCQ
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  values (v_section_id, 'Choose the correct letter, A, B, C or D.', 'mcq', 0)
  returning id into v_group_id;

  insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order) values
    (v_group_id,
     'Before the printing press, books were:',
     '["Mostly read silently","Copied by hand at high cost","Banned by the Catholic Church","Printed using wooden blocks"]'::jsonb,
     'B', 1),
    (v_group_id,
     'In the first decades after 1450, printers chiefly produced:',
     '["Vernacular novels","Maps and almanacs","The same texts that scribes had copied","Scientific journals"]'::jsonb,
     'C', 2),
    (v_group_id,
     'Roughly how many books were in circulation in Europe by 1500?',
     '["Two million","Twenty million","Eighty million","Two hundred million"]'::jsonb,
     'B', 3);
end
$seed$;


-- ── WRITING TASKS ──────────────────────────────────────────────────────────

insert into public.writing_tasks
  (external_id, source, task_type, exam_type, prompt_text, image_url, min_words)
values
  ('curated_writing_t1_01', 'curated', 'task1', 'academic',
$$The chart below shows the percentage of households in four countries that owned a personal computer between 2000 and 2020.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

Write at least 150 words.$$,
   null, 150),
  ('curated_writing_t2_01', 'curated', 'task2', 'academic',
$$Some people believe that universities should focus only on preparing students for the workforce. Others argue that the role of higher education is to develop critical thinking and a broad understanding of the world.

Discuss both views and give your own opinion.

Write at least 250 words.$$,
   null, 250)
on conflict (external_id) do update set
  source = excluded.source,
  task_type = excluded.task_type,
  exam_type = excluded.exam_type,
  prompt_text = excluded.prompt_text,
  min_words = excluded.min_words;


-- ── SPEAKING TOPICS ────────────────────────────────────────────────────────

insert into public.speaking_topics
  (external_id, source, part, topic_text, cue_card_points, follow_up_questions)
values
  ('curated_speaking_p1_01', 'curated', 1,
   'Tell me about where you live.',
   null,
   '["Do you live in a house or an apartment?","How long have you lived there?","What do you like most about the area?","Would you like to move somewhere else in the future? Why?"]'::jsonb),

  ('curated_speaking_p2_01', 'curated', 2,
   'Describe a skill that you would like to learn.',
   '["What the skill is","Why you would like to learn it","How you would go about learning it","How this skill would benefit you"]'::jsonb,
   null),

  ('curated_speaking_p3_01', 'curated', 3,
$$Let's talk more about learning new skills.$$,
   null,
   '["Why do you think some people find it harder than others to learn new skills as adults?","How has technology changed the way people learn?","Do you think it is better to learn a skill on your own or with a teacher? Why?","What kinds of skills will be most important in the future?"]'::jsonb)
on conflict (external_id) do update set
  source = excluded.source,
  part = excluded.part,
  topic_text = excluded.topic_text,
  cue_card_points = excluded.cue_card_points,
  follow_up_questions = excluded.follow_up_questions;
