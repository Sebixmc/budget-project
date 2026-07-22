-- ============================================================================
--  Family Budget App — initial schema (Postgres / Supabase)
-- ----------------------------------------------------------------------------
--  Port of the legacy SQLite schema (database.py) to multi-user Postgres.
--
--  LOAD-BEARING SECURITY (CLAUDE.md hard rule #1, ADR-004): every table carries
--  a `user_id` and has Row-Level Security enabled with policies scoping every
--  row to `auth.uid()`. A user can only ever read/write their own rows, enforced
--  by the database — not by application code.
--
--  Domain invariants preserved:
--    * amounts stored positive; direction in `flow` (hard rule #4)
--    * transfers excluded from money aggregations by callers (category='Transfer')
--    * idempotent CSV re-import via UNIQUE(user_id, account_id, date, desc, amount, flow)
--    * category_source='manual' never overwritten by auto-categorization
--
--  Forward-only migration. Never edit this file after it has been applied; add a
--  new numbered migration instead (hard rule #5).
-- ============================================================================

-- ---- helper: reusable updated_at trigger -----------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- accounts --------------------------------------------------------------
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  type        text not null default 'checking',
  owner       text not null default '',
  bank_format text not null default 'capital_one_bank'
              check (bank_format in ('capital_one_credit', 'capital_one_bank', 'uccu_checking')),
  created_at  timestamptz not null default now()
);
create index if not exists accounts_user_id_idx on public.accounts (user_id);

-- ---- transactions ----------------------------------------------------------
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id      uuid not null references public.accounts (id) on delete cascade,
  date            date not null,
  description     text not null,
  amount          numeric(14, 2) not null check (amount >= 0),  -- always positive; hard rule #4
  flow            text not null check (flow in ('debit', 'credit')),
  category        text not null default 'Uncategorized',
  category_source text not null default 'auto' check (category_source in ('auto', 'manual')),
  notes           text not null default '',
  raw_category    text not null default '',
  upload_batch    text not null default '',
  created_at      timestamptz not null default now(),
  -- Idempotent re-import (hard rule #6): the same row twice is skipped, not doubled.
  unique (user_id, account_id, date, description, amount, flow)
);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category);

-- ---- uploads (import log) --------------------------------------------------
create table if not exists public.uploads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id    uuid references public.accounts (id) on delete set null,
  filename      text not null default '',
  rows_imported integer not null default 0,
  rows_skipped  integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists uploads_user_id_idx on public.uploads (user_id);

-- ---- merchant_rules --------------------------------------------------------
create table if not exists public.merchant_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern    text not null,          -- lowercased substring matched against descriptions
  category   text not null,
  created_at timestamptz not null default now(),
  unique (user_id, pattern)
);
create index if not exists merchant_rules_user_id_idx on public.merchant_rules (user_id);

-- ---- goals -----------------------------------------------------------------
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  target_amount  numeric(14, 2) not null default 0,
  current_amount numeric(14, 2) not null default 0,
  color          text not null default '#10b981',
  target_date    date,
  notes          text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists goals_user_id_idx on public.goals (user_id);

-- ---- rainy_day_log ---------------------------------------------------------
create table if not exists public.rainy_day_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  balance    numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists rainy_day_log_user_id_idx on public.rainy_day_log (user_id);

-- ---- budget_categories -----------------------------------------------------
create table if not exists public.budget_categories (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category      text not null,
  monthly_limit numeric(14, 2) not null default 0,
  flow_type     text not null default 'expense' check (flow_type in ('expense', 'income')),
  primary key (user_id, category)
);

-- ---- budget_income (one row per user) --------------------------------------
create table if not exists public.budget_income (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_estimate numeric(14, 2) not null default 0,
  updated_at       timestamptz not null default now()
);
create trigger budget_income_updated_at
  before update on public.budget_income
  for each row execute function public.set_updated_at();

-- ============================================================================
--  Row-Level Security — the load-bearing isolation. Enable + own-rows policy
--  on EVERY table. Without these policies, RLS-enabled tables deny all access.
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'transactions', 'uploads', 'merchant_rules',
    'goals', 'rainy_day_log', 'budget_categories', 'budget_income'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    -- One permissive policy per command, all scoped to the owner.
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select using (user_id = auth.uid());
      create policy %1$s_insert on public.%1$I
        for insert with check (user_id = auth.uid());
      create policy %1$s_update on public.%1$I
        for update using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy %1$s_delete on public.%1$I
        for delete using (user_id = auth.uid());
    $f$, t);
  end loop;
end;
$$;

-- ============================================================================
--  Seed default accounts for each new user on sign-up.
--  SECURITY DEFINER so it can insert into a table it doesn't "own"; it only ever
--  writes rows for the NEW user's id, so isolation is preserved.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type, owner, bank_format) values
    (new.id, 'Savor Credit Card', 'credit',   'Joint', 'capital_one_credit'),
    (new.id, 'Sebi Checking',     'checking', 'Sebi',  'capital_one_bank'),
    (new.id, 'Olivia Checking',   'checking', 'Olivia','capital_one_bank'),
    (new.id, 'Seblivia Savings',  'savings',  'Joint', 'capital_one_bank');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
