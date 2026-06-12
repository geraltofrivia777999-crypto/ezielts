-- Lava payment integration: payment audit log + Lava fields on subscriptions.

alter table public.subscriptions
  add column if not exists lava_contract_id text,
  add column if not exists lava_offer_id text,
  add column if not exists payment_provider text default 'manual';

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'lava',
  provider_invoice_id text unique,
  provider_offer_id text,
  plan text check (plan in ('pro_monthly', 'pro_quarterly', 'pro_annual')),
  amount numeric,
  currency text,
  status text not null default 'created',
  event_type text,
  raw_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_provider_invoice_id_idx on public.payments(provider_invoice_id);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.handle_updated_at();

alter table public.payments enable row level security;

drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments"
  on public.payments for select
  using ((select auth.uid()) = user_id);
