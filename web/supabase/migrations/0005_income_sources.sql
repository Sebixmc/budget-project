-- ============================================================================
--  0005 — Itemized income sources on the budget profile
-- ----------------------------------------------------------------------------
--  Additive, forward-only (hard rule #5). The budget builder's single gross
--  input becomes a list of yearly income sources (e.g. salary + side income);
--  taxes apply to their combined gross. Shape mirrors tax_lines:
--    jsonb array of {name: string, amount: number}  — amount is YEARLY.
--  budget_profile.gross_annual stays and is kept equal to the sum by the
--  server action, so every existing reader keeps working unchanged.
--  RLS is already enabled on budget_profile (0003); no new policies needed.
-- ============================================================================

alter table public.budget_profile
  add column if not exists income_sources jsonb not null default '[]';
