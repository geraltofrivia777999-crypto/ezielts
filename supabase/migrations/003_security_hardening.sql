-- ============================================================================
-- 003_security_hardening.sql
-- Plugs holes uncovered in the security audit:
--   1. profiles.is_admin column was referenced from lib/admin.ts but never
--      declared in the schema; admin gate effectively always denied access.
--   2. Users could UPDATE their own row in user_daily_usage and reset
--      ai_tutor_total → 0, bypassing freemium limits.
--   3. diagnostic_results allowed anonymous INSERT with no check at all,
--      enabling spam + impersonation of another user_id.
--   4. user_test_attempts INSERT trusted band_score from the client.
--      Mitigated server-side via clampBand() in API routes; this migration
--      additionally enforces the IELTS valid range at the DB level.
-- ============================================================================

-- 1. is_admin column ---------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Self-update of is_admin must be impossible. Replace the broad update
-- policy with one that explicitly forbids changing is_admin from the
-- client. (Admin promotion is service-role only.)
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile (non-admin fields)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
  );

-- 2. user_daily_usage — drop client UPDATE policy ---------------------------
-- All increments go through the increment_usage() SECURITY DEFINER function.
drop policy if exists "Users can update own usage" on public.user_daily_usage;

-- 3. diagnostic_results — restrict INSERT -----------------------------------
drop policy if exists "Anyone can insert diagnostic" on public.diagnostic_results;

create policy "Users insert own (or anonymous) diagnostic"
  on public.diagnostic_results for insert
  with check (
    -- Anonymous users may still submit a diagnostic, but the row's user_id
    -- must be NULL — they cannot impersonate a real user.
    (auth.uid() is null and user_id is null)
    or auth.uid() = user_id
  );

-- 4. study_plan rate-limit support ------------------------------------------
-- Daily counter column for the new "study_plan" content type.
alter table public.user_daily_usage
  add column if not exists study_plan_count integer not null default 0;

-- Extend check_daily_limit / increment_usage to recognise "study_plan"
-- (free tier: 1 plan generation per day).
create or replace function public.check_daily_limit(
  p_user_id      uuid,
  p_content_type text
) returns boolean language plpgsql security definer as $$
declare
  v_is_pro     boolean;
  v_usage      public.user_daily_usage%rowtype;
  v_week_count int;
begin
  select public.is_pro(p_user_id) into v_is_pro;
  if v_is_pro then return true; end if;

  insert into public.user_daily_usage (user_id, date)
  values (p_user_id, current_date)
  on conflict (user_id, date) do nothing;

  select * into v_usage
  from public.user_daily_usage
  where user_id = p_user_id and date = current_date;

  if p_content_type = 'reading' then
    return v_usage.reading_count < 1;
  elsif p_content_type = 'listening' then
    return v_usage.listening_count < 1;
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
  elsif p_content_type = 'ai_tutor' then
    select coalesce(sum(ai_tutor_total), 0) into v_week_count
    from public.user_daily_usage
    where user_id = p_user_id;
    return v_week_count < 3;
  elsif p_content_type = 'study_plan' then
    return v_usage.study_plan_count < 1;
  else
    return false;
  end if;
end;
$$;

create or replace function public.increment_usage(
  p_user_id      uuid,
  p_content_type text
) returns void language plpgsql security definer as $$
begin
  insert into public.user_daily_usage (user_id, date)
  values (p_user_id, current_date)
  on conflict (user_id, date) do nothing;

  if p_content_type = 'reading' then
    update public.user_daily_usage set reading_count = reading_count + 1
    where user_id = p_user_id and date = current_date;
  elsif p_content_type = 'listening' then
    update public.user_daily_usage set listening_count = listening_count + 1
    where user_id = p_user_id and date = current_date;
  elsif p_content_type = 'writing' then
    update public.user_daily_usage set writing_count = writing_count + 1
    where user_id = p_user_id and date = current_date;
  elsif p_content_type = 'speaking' then
    update public.user_daily_usage set speaking_count = speaking_count + 1
    where user_id = p_user_id and date = current_date;
  elsif p_content_type = 'ai_tutor' then
    update public.user_daily_usage set ai_tutor_total = ai_tutor_total + 1
    where user_id = p_user_id and date = current_date;
  elsif p_content_type = 'study_plan' then
    update public.user_daily_usage set study_plan_count = study_plan_count + 1
    where user_id = p_user_id and date = current_date;
  end if;
end;
$$;

-- 5. user_test_attempts — enforce IELTS band range at DB level --------------
alter table public.user_test_attempts
  drop constraint if exists user_test_attempts_band_score_check;

alter table public.user_test_attempts
  add constraint user_test_attempts_band_score_check
  check (
    band_score is null
    or (band_score >= 0 and band_score <= 9 and (band_score * 2) = floor(band_score * 2))
  );
