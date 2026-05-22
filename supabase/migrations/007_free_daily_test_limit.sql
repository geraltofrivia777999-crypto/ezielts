-- Free users get one scored test per calendar day across all IELTS skills.
-- Pro users stay unlimited through public.is_pro().

create or replace function public.check_daily_limit(
  p_user_id      uuid,
  p_content_type text
)
returns boolean language plpgsql security definer as $$
declare
  v_is_pro      boolean;
  v_usage       public.user_daily_usage%rowtype;
  v_total_tests int;
  v_total_ai    int;
begin
  select public.is_pro(p_user_id) into v_is_pro;
  if v_is_pro then return true; end if;

  insert into public.user_daily_usage (user_id, date)
  values (p_user_id, current_date)
  on conflict (user_id, date) do nothing;

  select * into v_usage
  from public.user_daily_usage
  where user_id = p_user_id and date = current_date;

  if p_content_type in ('reading', 'listening', 'writing', 'speaking') then
    v_total_tests :=
      coalesce(v_usage.reading_count, 0)
      + coalesce(v_usage.listening_count, 0)
      + coalesce(v_usage.writing_count, 0)
      + coalesce(v_usage.speaking_count, 0);
    return v_total_tests < 1;

  elsif p_content_type = 'ai_tutor' then
    select coalesce(sum(ai_tutor_total), 0) into v_total_ai
    from public.user_daily_usage
    where user_id = p_user_id;
    return v_total_ai < 3;

  elsif p_content_type = 'study_plan' then
    return coalesce((to_jsonb(v_usage) ->> 'study_plan_count')::int, 0) < 1;

  else
    return false;
  end if;
end;
$$;
