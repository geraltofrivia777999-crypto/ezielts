-- Add the quarterly Pro plan to subscription constraints and central access
-- checks. The pricing page already offers pro_quarterly, so it must be
-- treated as paid access everywhere AI/pro gating uses public.is_pro().

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'pro_monthly', 'pro_quarterly', 'pro_annual'));

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
