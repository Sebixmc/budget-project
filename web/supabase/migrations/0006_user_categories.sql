-- 0006: user_categories (2026-08-04)
--   User-created categories, so the assignable category list is no longer
--   limited to the built-in keyword categories in lib/categorizer.ts. A row
--   here is a category the user made that may have zero transactions yet, so it
--   still needs somewhere to persist (categories in use are inferred from data).
--   Ships with user_id + RLS in the same migration (hard rule #1 & #5).
--   Additive, forward-only.

create table if not exists public.user_categories (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

-- ---- Row-Level Security: owner-only, one policy per command -----------------
alter table public.user_categories enable row level security;

create policy user_categories_select on public.user_categories
  for select using (user_id = auth.uid());
create policy user_categories_insert on public.user_categories
  for insert with check (user_id = auth.uid());
create policy user_categories_delete on public.user_categories
  for delete using (user_id = auth.uid());
