-- 0004: user_settings (2026-08-04)
--   Per-user app preferences that don't belong to any existing table.
--   Currently: default landing page after sign-in. Theme is client-side only
--   (localStorage), so it is intentionally NOT stored here.
--   Ships with user_id + RLS in the same migration (hard rule #1 & #5).

create table if not exists public.user_settings (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  default_page text not null default '/dashboard',
  updated_at   timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---- Row-Level Security: owner-only, one policy per command -----------------
alter table public.user_settings enable row level security;

create policy user_settings_select on public.user_settings
  for select using (user_id = auth.uid());
create policy user_settings_insert on public.user_settings
  for insert with check (user_id = auth.uid());
create policy user_settings_update on public.user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_delete on public.user_settings
  for delete using (user_id = auth.uid());
