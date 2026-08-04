-- ============================================================================
--  0003 — Budget builder (paycheck cascade): budget_profile + savings_goals
-- ----------------------------------------------------------------------------
--  Additive, forward-only (hard rule #5). Both tables carry user_id and ship
--  their own-rows RLS policies IN THIS FILE (hard rule #1). Amounts stored
--  positive (hard rule #4). See specs/budget-builder.md.
--
--  tax_lines shape: jsonb array of {name: string, kind: 'percent' | 'amount',
--  value: number} — percent of gross, or a fixed YEARLY amount. Validated by
--  the server action; kept as jsonb to hold migration 0003 to two tables.
-- ============================================================================

-- ---- budget_profile (one row per user) --------------------------------------
create table if not exists public.budget_profile (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  gross_annual numeric(14, 2) not null default 0 check (gross_annual >= 0),
  tax_lines    jsonb not null default '[]',
  updated_at   timestamptz not null default now()
);
create trigger budget_profile_updated_at
  before update on public.budget_profile
  for each row execute function public.set_updated_at();

-- ---- savings_goals ----------------------------------------------------------
-- Simple monthly commitments ("pay yourself first"). Deliberately NOT linked
-- to the dormant goals table (targets/progress) — spec Decision #2.
create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  monthly_amount numeric(14, 2) not null default 0 check (monthly_amount >= 0),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists savings_goals_user_id_idx on public.savings_goals (user_id);

-- ============================================================================
--  Row-Level Security — same four own-rows policies as every other table.
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['budget_profile', 'savings_goals']
  loop
    execute format('alter table public.%I enable row level security;', t);
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
