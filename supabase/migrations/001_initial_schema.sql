-- ============================================================
--  EZielts — Initial Schema
--  Migration 001
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fuzzy search on passages

-- ============================================================
--  PROFILES
--  One row per auth.users user
-- ============================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text,
  email           text,
  avatar_url      text,
  target_band     numeric(3,1) default 7.0 check (target_band between 1 and 9),
  exam_type       text check (exam_type in ('academic','general','unknown')) default 'unknown',
  goal            text check (goal in ('university','migration','work','other')) default 'other',
  exam_date       date,
  current_band    numeric(3,1),
  -- Reading / Listening / Writing / Speaking last known bands
  band_reading    numeric(3,1),
  band_listening  numeric(3,1),
  band_writing    numeric(3,1),
  band_speaking   numeric(3,1),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
--  SUBSCRIPTIONS
-- ============================================================
create table public.subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  plan                text not null check (plan in ('free','pro_monthly','pro_quarterly','pro_annual')) default 'free',
  status              text not null check (status in ('active','cancelled','expired','trialing')) default 'active',
  freedompay_sub_id   text,                    -- FreedomPay subscription token
  trial_ends_at       timestamptz,
  current_period_start timestamptz,
  current_period_end  timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (user_id)    -- one active subscription per user
);

-- ============================================================
--  DAILY / LIFETIME USAGE COUNTERS
-- ============================================================
create table public.user_daily_usage (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  date            date not null default current_date,
  reading_count   int not null default 0,
  listening_count int not null default 0,
  writing_count   int not null default 0,  -- resets weekly (checked via day-of-week)
  speaking_count  int not null default 0,  -- resets weekly
  ai_tutor_total  int not null default 0,  -- lifetime, never resets
  unique (user_id, date)
);

-- ============================================================
--  READING TESTS
-- ============================================================
create table public.reading_tests (
  id            uuid primary key default uuid_generate_v4(),
  source        text not null,             -- 'practicepteonline' | 'cathoven' | 'cambridge'
  category      text not null,             -- e.g. 'academic', 'general'
  title         text not null,
  difficulty    text check (difficulty in ('easy','medium','hard')),
  external_id   text unique,               -- original ID from source JSON
  created_at    timestamptz default now()
);

create table public.reading_sections (
  id            uuid primary key default uuid_generate_v4(),
  test_id       uuid not null references public.reading_tests(id) on delete cascade,
  part_number   int not null default 1,
  passage_text  text not null,
  created_at    timestamptz default now()
);

create table public.reading_question_groups (
  id            uuid primary key default uuid_generate_v4(),
  section_id    uuid not null references public.reading_sections(id) on delete cascade,
  instruction   text,
  question_type text not null,             -- 'mcq' | 'tfng' | 'matching' | 'completion' | 'short_answer'
  sort_order    int not null default 0
);

create table public.reading_questions (
  id              uuid primary key default uuid_generate_v4(),
  group_id        uuid not null references public.reading_question_groups(id) on delete cascade,
  question_text   text not null,
  options         jsonb,                   -- ["A","B","C","D"] or null for free-text
  correct_answer  text not null,           -- "B" or "TRUE" or free-text
  explanation     text,
  sort_order      int not null default 0
);

-- ============================================================
--  LISTENING TESTS
-- ============================================================
create table public.listening_tests (
  id            uuid primary key default uuid_generate_v4(),
  source        text not null default 'practicepteonline',
  title         text not null,
  section       int check (section between 1 and 4),
  audio_url     text,                      -- Supabase Storage CDN URL
  audio_duration int,                      -- seconds
  transcript    text,
  external_id   text unique,
  created_at    timestamptz default now()
);

create table public.listening_question_groups (
  id            uuid primary key default uuid_generate_v4(),
  test_id       uuid not null references public.listening_tests(id) on delete cascade,
  instruction   text,
  question_type text not null,
  sort_order    int not null default 0
);

create table public.listening_questions (
  id              uuid primary key default uuid_generate_v4(),
  group_id        uuid not null references public.listening_question_groups(id) on delete cascade,
  question_text   text not null,
  options         jsonb,
  correct_answer  text not null,
  sort_order      int not null default 0
);

-- ============================================================
--  WRITING TASKS
-- ============================================================
create table public.writing_tasks (
  id            uuid primary key default uuid_generate_v4(),
  source        text not null default 'practicepteonline',
  task_type     text not null check (task_type in ('task1','task2')),
  exam_type     text check (exam_type in ('academic','general')),
  prompt_text   text not null,
  image_url     text,                      -- for Task 1 charts/graphs
  sample_answer text,
  min_words     int not null default 150,
  external_id   text unique,
  created_at    timestamptz default now()
);

-- ============================================================
--  SPEAKING TOPICS
-- ============================================================
create table public.speaking_topics (
  id                    uuid primary key default uuid_generate_v4(),
  source                text not null default 'practicepteonline',
  part                  int not null check (part between 1 and 3),
  topic_text            text not null,    -- Part 1/3: question. Part 2: cue card title
  cue_card_points       jsonb,            -- Part 2: bullet points
  follow_up_questions   jsonb,            -- Part 3: array of questions
  sample_answer         text,
  band_range            text,             -- e.g. "6-7"
  external_id           text unique,
  created_at            timestamptz default now()
);

-- ============================================================
--  USER TEST ATTEMPTS
-- ============================================================
create table public.user_test_attempts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  content_type    text not null check (content_type in ('reading','listening','writing','speaking')),
  content_id      uuid not null,           -- FK to appropriate test table (polymorphic)
  answers         jsonb,                   -- {"q_id": "answer", ...}
  band_score      numeric(3,1),
  raw_score       int,
  total_questions int,
  ai_feedback     jsonb,                   -- {overall, criteria: [{code, band, comment}], improvements}
  time_spent      int,                     -- seconds
  completed_at    timestamptz default now(),
  created_at      timestamptz default now()
);

-- Index for fast per-user history queries
create index idx_attempts_user_type on public.user_test_attempts(user_id, content_type, completed_at desc);
create index idx_attempts_user_date  on public.user_test_attempts(user_id, completed_at desc);

-- ============================================================
--  CONTENT SEEN (prevents repetition)
-- ============================================================
create table public.user_content_seen (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  content_type    text not null,
  content_id      uuid not null,
  seen_at         timestamptz default now(),
  unique (user_id, content_type, content_id)
);

create index idx_seen_user_type on public.user_content_seen(user_id, content_type);

-- ============================================================
--  DIAGNOSTIC RESULTS
--  Stored separately so they're available before signup
-- ============================================================
create table public.diagnostic_results (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete set null,
  session_token   text,                    -- for anonymous users before signup
  band_reading    numeric(3,1),
  band_listening  numeric(3,1),
  band_grammar    numeric(3,1),
  overall_band    numeric(3,1),
  weak_skills     text[],                  -- ['reading','grammar']
  answers         jsonb,
  created_at      timestamptz default now()
);

-- ============================================================
--  AI TUTOR MESSAGES
-- ============================================================
create table public.ai_tutor_messages (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz default now()
);

create index idx_tutor_user on public.ai_tutor_messages(user_id, created_at);

-- ============================================================
--  UPDATED_AT triggers
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ============================================================
--  AUTO-CREATE profile + subscription on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
