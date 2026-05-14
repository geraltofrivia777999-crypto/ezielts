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
-- The `source` column is marked 'curated' so it can be distinguished from
-- the legacy 'practicepteonline' / 'cathoven' rows.
--
-- IDEMPOTENCY: every row uses a deterministic `external_id` starting with
-- 'curated_' so re-running the migration via `on conflict (external_id)`
-- updates in place instead of duplicating.
-- ============================================================================

-- ── READING TEST ───────────────────────────────────────────────────────────

insert into public.reading_tests (external_id, source, category, title, difficulty)
values ('curated_reading_01', 'curated', 'academic', 'The Science of Sleep', 'medium')
on conflict (external_id) do update set
  source = excluded.source,
  category = excluded.category,
  title = excluded.title,
  difficulty = excluded.difficulty;

-- Replace child rows on every run so updates are clean.
delete from public.reading_sections
where test_id = (select id from public.reading_tests where external_id = 'curated_reading_01');

-- ─ Passage 1 ─
with t as (
  select id from public.reading_tests where external_id = 'curated_reading_01'
), s1 as (
  insert into public.reading_sections (test_id, part_number, passage_text)
  select id, 1, $$Sleep is one of the most fundamental and least understood aspects of human biology. For most of the twentieth century, scientists assumed that sleep was a passive state — a kind of nightly shutdown during which the brain idled in preparation for the next day. Modern neuroscience has overturned this view almost completely. The sleeping brain is now known to be intensely active, cycling through several distinct stages that each play a specific role in memory, learning and physical recovery.

The most striking discovery is the importance of so-called slow-wave sleep, which dominates the early hours of the night. During these stages, neurons fire in synchronised patterns that appear to consolidate information acquired during the day, transferring it from short-term storage in the hippocampus to longer-term networks in the cortex. Experiments have shown that students who sleep after studying retain significantly more than those who stay awake the same length of time. Rapid Eye Movement (REM) sleep, which intensifies later in the night, plays a different role: it integrates new memories with existing knowledge and is closely linked to creative problem-solving.

Despite these findings, modern life is increasingly hostile to good sleep. Artificial light, irregular schedules and the ubiquity of screens have all been shown to disrupt the circadian rhythms that govern sleep timing. The consequences extend far beyond tiredness. Chronic sleep deprivation is now associated with weakened immune function, weight gain, impaired decision-making and a heightened risk of cardiovascular disease.$$
  from t
  returning id
), g1 as (
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  select id, 'Choose the correct letter, A, B, C or D.', 'mcq', 0 from s1
  returning id
), q1 as (
  insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order)
  select id, q.qtext, q.qopts::jsonb, q.qans, q.qord from g1, (values
    ('What was the prevailing scientific view of sleep before the late 20th century?',
     '["That it was essential for muscle repair","That it was a passive shutdown of the brain","That it was needed only by mammals","That it was caused by darkness"]', 'B', 1),
    ('According to the passage, slow-wave sleep is most directly responsible for:',
     '["Resolving emotional conflict","Improving physical reflexes","Consolidating recently learned information","Reducing the need for REM sleep"]', 'C', 2),
    ('Which of the following is presented as a consequence of chronic sleep deprivation?',
     '["Improved short-term memory","Heightened cardiovascular risk","Increased empathy","Slower aging"]', 'B', 3)
  ) as q(qtext, qopts, qans, qord)
  returning id
), g2 as (
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  select id, 'Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.', 'tfng', 1 from s1
  returning id
)
insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order)
select id, q.qtext, '["TRUE","FALSE","NOT GIVEN"]'::jsonb, q.qans, q.qord from g2, (values
  ('Students who sleep after studying remember more than students who do not.', 'TRUE', 4),
  ('REM sleep is the longest phase of the sleep cycle.', 'NOT GIVEN', 5),
  ('Artificial light has no effect on circadian rhythms.', 'FALSE', 6)
) as q(qtext, qans, qord);

-- ─ Passage 2 ─
with t as (
  select id from public.reading_tests where external_id = 'curated_reading_01'
), s2 as (
  insert into public.reading_sections (test_id, part_number, passage_text)
  select id, 2, $$The history of cities is, in many ways, the history of how human beings have negotiated the tension between proximity and privacy. The earliest urban settlements in Mesopotamia and the Indus Valley were dense, walled spaces in which families lived close together for defence and trade. The Greek polis introduced the idea of the public square — the agora — as a space distinct from the household, where citizens could debate, transact and be seen. The Roman city expanded the public realm further, with baths, forums and amphitheatres that brought tens of thousands of strangers into shared spaces.

For much of the medieval period, European cities contracted again. Walls were rebuilt, and most daily life occurred within tight networks of kinship and craft. It was the early modern period, particularly the seventeenth and eighteenth centuries, that produced the recognisably modern city: planned boulevards, public parks, coffeehouses and theatres. These were spaces designed not for survival but for sociability — and, importantly, for being observed by others.

The twentieth century shifted the balance again. The rise of the automobile and the spread of suburbs encouraged a retreat into private space. By mid-century, many North American cities had emptied their downtowns at night, with workers commuting home to detached houses and self-contained yards. Critics such as Jane Jacobs warned that this withdrawal would impoverish urban life, removing the "eyes on the street" that made cities feel safe and alive. Her work helped seed a counter-movement that, decades later, has produced renewed interest in walkable neighbourhoods, mixed-use development and the gentle density of nineteenth-century street grids.$$
  from t
  returning id
), g3 as (
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  select id, 'Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.', 'tfng', 0 from s2
  returning id
)
insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order)
select id, q.qtext, '["TRUE","FALSE","NOT GIVEN"]'::jsonb, q.qans, q.qord from g3, (values
  ('The Greek agora was primarily a religious space.', 'FALSE', 1),
  ('Roman amphitheatres could hold tens of thousands of people.', 'TRUE', 2),
  ('Medieval European cities were larger than Roman cities.', 'NOT GIVEN', 3),
  ('Jane Jacobs argued that suburban living improved city life.', 'FALSE', 4)
) as q(qtext, qans, qord);

-- ─ Passage 3 ─
with t as (
  select id from public.reading_tests where external_id = 'curated_reading_01'
), s3 as (
  insert into public.reading_sections (test_id, part_number, passage_text)
  select id, 3, $$Few inventions have reshaped human society as quickly as the printing press. Before its diffusion across Europe in the second half of the fifteenth century, books were reproduced by hand — a slow, costly process that effectively restricted literacy to clergy and the wealthy. Johannes Gutenberg's combination of movable metal type, an adapted wine-press and a durable oil-based ink reduced the cost of producing a book by perhaps two orders of magnitude within a single generation.

The cultural consequences were profound but not immediate. In the first decades after 1450, printers mostly reproduced the same texts that scribes had copied for centuries — Latin Bibles, classical philosophy, legal commentaries. Innovation in content followed only as the network of presses expanded and as printers began competing for a wider readership. Vernacular literature in French, German and English appeared in growing numbers from the 1480s. Maps, almanacs and scientific treatises followed soon after.

Historians continue to debate the press's role in the Reformation, the Scientific Revolution and the gradual emergence of public opinion. What seems clear is that the technology accelerated existing trends rather than creating them outright. A literate urban class had begun to grow in northern Italy and the Low Countries well before Gutenberg, and the demand for cheap, accessible texts was already considerable. The press met this demand at an extraordinary scale — by 1500, roughly twenty million books were in circulation, in a Europe whose total population was perhaps eighty million.$$
  from t
  returning id
), g4 as (
  insert into public.reading_question_groups (section_id, instruction, question_type, sort_order)
  select id, 'Choose the correct letter, A, B, C or D.', 'mcq', 0 from s3
  returning id
)
insert into public.reading_questions (group_id, question_text, options, correct_answer, sort_order)
select id, q.qtext, q.qopts::jsonb, q.qans, q.qord from g4, (values
  ('Before the printing press, books were:',
   '["Mostly read silently","Copied by hand at high cost","Banned by the Catholic Church","Printed using wooden blocks"]', 'B', 1),
  ('In the first decades after 1450, printers chiefly produced:',
   '["Vernacular novels","Maps and almanacs","The same texts that scribes had copied","Scientific journals"]', 'C', 2),
  ('Roughly how many books were in circulation in Europe by 1500?',
   '["Two million","Twenty million","Eighty million","Two hundred million"]', 'B', 3)
) as q(qtext, qans, qord);


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
