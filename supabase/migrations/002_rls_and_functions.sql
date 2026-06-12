-- ============================================================
--  ieltszen — RLS Policies + Freemium Functions
--  Migration 002
-- ============================================================

-- ── Helper: is current user Pro? ────────────────────────────
create or replace function public.is_pro(uid uuid default auth.uid())
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = uid
      and plan in ('pro_monthly', 'pro_quarterly', 'pro_annual')
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- ============================================================
--  check_daily_limit(content_type)
--  Returns TRUE if the user is allowed to start a new test.
--  Called from the API route before serving content.
--
--  Free limits:
--    reading   → 1 / day
--    listening → 1 / day
--    writing   → 1 / week  (Mon–Sun)
--    speaking  → 1 / week
--    ai_tutor  → 3 lifetime
-- ============================================================
create or replace function public.check_daily_limit(
  p_user_id     uuid,
  p_content_type text   -- 'reading' | 'listening' | 'writing' | 'speaking' | 'ai_tutor'
)
returns boolean language plpgsql security definer as $$
declare
  v_is_pro     boolean;
  v_usage      public.user_daily_usage%rowtype;
  v_week_count int;
begin
  -- Pro users have no limits
  select public.is_pro(p_user_id) into v_is_pro;
  if v_is_pro then return true; end if;

  -- Ensure today's usage row exists
  insert into public.user_daily_usage (user_id, date)
  values (p_user_id, current_date)
  on conflict (user_id, date) do nothing;

  select * into v_usage
  from public.user_daily_usage
  where user_id = p_user_id and date = current_date;

  -- ── Daily limits ─────────────────────────
  if p_content_type = 'reading' then
    return v_usage.reading_count < 1;

  elsif p_content_type = 'listening' then
    return v_usage.listening_count < 1;

  -- ── Weekly limits (sum Mon–Sun of current week) ─
  elsif p_content_type = 'writing' then
    select coalesce(sum(writing_count), 0) into v_week_count
    from public.user_daily_usage
    where user_id = p_user_id
      and date >= date_trunc('week', current_date)::date
      and date <= current_date;
    return v_week_count < 1;

  elsif p_content_type = 'speaking' then
    select coalesce(sum(speaking_count), 0) into v_week_count
    from public.user_daily_usage
    where user_id = p_user_id
      and date >= date_trunc('week', current_date)::date
      and date <= current_date;
    return v_week_count < 1;

  -- ── Lifetime limit ──────────────────────
  elsif p_content_type = 'ai_tutor' then
    select coalesce(sum(ai_tutor_total), 0) into v_week_count
    from public.user_daily_usage
    where user_id = p_user_id;
    return v_week_count < 3;

  else
    return false;
  end if;
end;
$$;

-- ============================================================
--  increment_usage(content_type)
--  Call after a test is successfully started/submitted.
-- ============================================================
create or replace function public.increment_usage(
  p_user_id      uuid,
  p_content_type text
)
returns void language plpgsql security definer as $$
begin
  insert into public.user_daily_usage (user_id, date)
  values (p_user_id, current_date)
  on conflict (user_id, date) do nothing;

  if p_content_type = 'reading' then
    update public.user_daily_usage
    set reading_count = reading_count + 1
    where user_id = p_user_id and date = current_date;

  elsif p_content_type = 'listening' then
    update public.user_daily_usage
    set listening_count = listening_count + 1
    where user_id = p_user_id and date = current_date;

  elsif p_content_type = 'writing' then
    update public.user_daily_usage
    set writing_count = writing_count + 1
    where user_id = p_user_id and date = current_date;

  elsif p_content_type = 'speaking' then
    update public.user_daily_usage
    set speaking_count = speaking_count + 1
    where user_id = p_user_id and date = current_date;

  elsif p_content_type = 'ai_tutor' then
    update public.user_daily_usage
    set ai_tutor_total = ai_tutor_total + 1
    where user_id = p_user_id and date = current_date;
  end if;
end;
$$;

-- ============================================================
--  get_next_reading(user_id)
--  Returns a reading test the user hasn't seen yet.
--  If all tests seen → resets their seen list and starts over.
-- ============================================================
create or replace function public.get_next_reading(p_user_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_test_id uuid;
begin
  -- Try to find an unseen test
  select t.id into v_test_id
  from public.reading_tests t
  where t.id not in (
    select content_id from public.user_content_seen
    where user_id = p_user_id and content_type = 'reading'
  )
  order by random()
  limit 1;

  -- If nothing left, reset seen list and pick any
  if v_test_id is null then
    delete from public.user_content_seen
    where user_id = p_user_id and content_type = 'reading';

    select id into v_test_id
    from public.reading_tests
    order by random()
    limit 1;
  end if;

  -- Mark as seen
  if v_test_id is not null then
    insert into public.user_content_seen (user_id, content_type, content_id)
    values (p_user_id, 'reading', v_test_id)
    on conflict do nothing;
  end if;

  return v_test_id;
end;
$$;

-- Same pattern for listening, writing, speaking
create or replace function public.get_next_listening(p_user_id uuid)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  select t.id into v_id
  from public.listening_tests t
  where t.id not in (
    select content_id from public.user_content_seen
    where user_id = p_user_id and content_type = 'listening'
  )
  order by random() limit 1;

  if v_id is null then
    delete from public.user_content_seen
    where user_id = p_user_id and content_type = 'listening';
    select id into v_id from public.listening_tests order by random() limit 1;
  end if;

  if v_id is not null then
    insert into public.user_content_seen (user_id, content_type, content_id)
    values (p_user_id, 'listening', v_id)
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

create or replace function public.get_next_writing(p_user_id uuid, p_task_type text default null)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  select t.id into v_id
  from public.writing_tasks t
  where (p_task_type is null or t.task_type = p_task_type)
    and t.id not in (
      select content_id from public.user_content_seen
      where user_id = p_user_id and content_type = 'writing'
    )
  order by random() limit 1;

  if v_id is null then
    delete from public.user_content_seen
    where user_id = p_user_id and content_type = 'writing';
    select id into v_id from public.writing_tasks
    where (p_task_type is null or task_type = p_task_type)
    order by random() limit 1;
  end if;

  if v_id is not null then
    insert into public.user_content_seen (user_id, content_type, content_id)
    values (p_user_id, 'writing', v_id)
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

-- ============================================================
--  update_profile_band()
--  Recomputes current band from last 3 attempts per skill.
--  Called after every attempt submission.
-- ============================================================
create or replace function public.update_profile_band(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_reading   numeric(3,1);
  v_listening numeric(3,1);
  v_writing   numeric(3,1);
  v_speaking  numeric(3,1);
  v_overall   numeric(3,1);
begin
  -- Average of last 3 attempts per skill (rounded to nearest 0.5)
  select round(avg(band_score) * 2) / 2 into v_reading
  from (
    select band_score from public.user_test_attempts
    where user_id = p_user_id and content_type = 'reading' and band_score is not null
    order by completed_at desc limit 3
  ) t;

  select round(avg(band_score) * 2) / 2 into v_listening
  from (
    select band_score from public.user_test_attempts
    where user_id = p_user_id and content_type = 'listening' and band_score is not null
    order by completed_at desc limit 3
  ) t;

  select round(avg(band_score) * 2) / 2 into v_writing
  from (
    select band_score from public.user_test_attempts
    where user_id = p_user_id and content_type = 'writing' and band_score is not null
    order by completed_at desc limit 3
  ) t;

  select round(avg(band_score) * 2) / 2 into v_speaking
  from (
    select band_score from public.user_test_attempts
    where user_id = p_user_id and content_type = 'speaking' and band_score is not null
    order by completed_at desc limit 3
  ) t;

  -- Overall = average of available skills
  select round(
    avg(v) * 2
  ) / 2 into v_overall
  from unnest(array[v_reading, v_listening, v_writing, v_speaking]) as v
  where v is not null;

  update public.profiles set
    band_reading    = v_reading,
    band_listening  = v_listening,
    band_writing    = v_writing,
    band_speaking   = v_speaking,
    current_band    = v_overall,
    updated_at      = now()
  where id = p_user_id;
end;
$$;

-- Auto-update band after every attempt
create or replace function public.trg_update_band_after_attempt()
returns trigger language plpgsql as $$
begin
  perform public.update_profile_band(new.user_id);
  return new;
end;
$$;

create trigger trg_attempt_inserted
  after insert on public.user_test_attempts
  for each row execute function public.trg_update_band_after_attempt();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles            enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.user_daily_usage    enable row level security;
alter table public.user_test_attempts  enable row level security;
alter table public.user_content_seen   enable row level security;
alter table public.diagnostic_results  enable row level security;
alter table public.ai_tutor_messages   enable row level security;

-- Public content tables (read-only for all authenticated users)
alter table public.reading_tests           enable row level security;
alter table public.reading_sections        enable row level security;
alter table public.reading_question_groups enable row level security;
alter table public.reading_questions       enable row level security;
alter table public.listening_tests         enable row level security;
alter table public.listening_question_groups enable row level security;
alter table public.listening_questions     enable row level security;
alter table public.writing_tasks           enable row level security;
alter table public.speaking_topics         enable row level security;

-- ── profiles ────────────────────────────────────────────────
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ── subscriptions ────────────────────────────────────────────
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Only server (service role) can update subscriptions
-- (FreedomPay webhook → server-side upsert)

-- ── daily usage ──────────────────────────────────────────────
create policy "Users can view own usage"
  on public.user_daily_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert own usage"
  on public.user_daily_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.user_daily_usage for update
  using (auth.uid() = user_id);

-- ── test attempts ────────────────────────────────────────────
create policy "Users can view own attempts"
  on public.user_test_attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert own attempts"
  on public.user_test_attempts for insert
  with check (auth.uid() = user_id);

-- ── content seen ─────────────────────────────────────────────
create policy "Users can manage own seen content"
  on public.user_content_seen for all
  using (auth.uid() = user_id);

-- ── diagnostic results ───────────────────────────────────────
create policy "Users can view own diagnostics"
  on public.diagnostic_results for select
  using (auth.uid() = user_id or user_id is null);

create policy "Anyone can insert diagnostic"
  on public.diagnostic_results for insert
  with check (true);  -- anonymous users too (session_token based)

-- ── AI tutor messages ────────────────────────────────────────
create policy "Users can manage own tutor messages"
  on public.ai_tutor_messages for all
  using (auth.uid() = user_id);

-- ── Content tables — authenticated read-only ─────────────────
create policy "Authenticated users can read reading tests"
  on public.reading_tests for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read reading sections"
  on public.reading_sections for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read question groups"
  on public.reading_question_groups for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read questions"
  on public.reading_questions for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read listening tests"
  on public.listening_tests for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read listening groups"
  on public.listening_question_groups for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read listening questions"
  on public.listening_questions for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read writing tasks"
  on public.writing_tasks for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read speaking topics"
  on public.speaking_topics for select
  using (auth.role() = 'authenticated');

-- ============================================================
--  USEFUL VIEWS
-- ============================================================

-- User dashboard summary (joins profile + subscription)
create or replace view public.v_user_summary as
select
  p.id,
  p.name,
  p.email,
  p.target_band,
  p.current_band,
  p.band_reading,
  p.band_listening,
  p.band_writing,
  p.band_speaking,
  p.exam_date,
  p.exam_type,
  coalesce(s.plan, 'free')    as plan,
  coalesce(s.status, 'active') as subscription_status,
  s.current_period_end,
  public.is_pro(p.id)          as is_pro,
  -- streak (consecutive days ending today with at least 1 attempt)
  (
    with dated as (
      select distinct completed_at::date as d
      from public.user_test_attempts
      where user_id = p.id
        and completed_at::date >= current_date - interval '60 days'
    ),
    numbered as (
      select d, row_number() over (order by d desc) as rn
      from dated
    )
    select count(*)::int
    from numbered
    where d = current_date - ((rn - 1) * interval '1 day')
  ) as streak
from public.profiles p
left join public.subscriptions s on s.user_id = p.id;

-- Band history per skill (last 30 days)
create or replace view public.v_band_history as
select
  user_id,
  content_type,
  completed_at::date as attempt_date,
  round(avg(band_score) * 2) / 2 as daily_band
from public.user_test_attempts
where band_score is not null
  and completed_at >= now() - interval '30 days'
group by user_id, content_type, completed_at::date
order by user_id, content_type, attempt_date;
