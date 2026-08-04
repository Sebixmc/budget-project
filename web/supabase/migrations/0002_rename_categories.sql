-- 0002: Rename categories (2026-08-04)
--   Dining         -> Eating Out
--   Gas & Fuel     -> Car & Gas
--   Rent & Housing -> Rent
-- Data-only migration; matches the categorizer rename in web/lib/categorizer.ts.
-- Idempotent: re-running matches zero rows. Safe for all users (runs as admin,
-- rows keep their user_id; manual categorizations keep category_source='manual').

update public.transactions set category = 'Eating Out' where category = 'Dining';
update public.transactions set category = 'Car & Gas'  where category = 'Gas & Fuel';
update public.transactions set category = 'Rent'       where category = 'Rent & Housing';

update public.merchant_rules set category = 'Eating Out' where category = 'Dining';
update public.merchant_rules set category = 'Car & Gas'  where category = 'Gas & Fuel';
update public.merchant_rules set category = 'Rent'       where category = 'Rent & Housing';

-- budget_categories has primary key (user_id, category): merge defensively in
-- case a user already has a row under the new name, then drop the old row.
insert into public.budget_categories (user_id, category, monthly_limit, flow_type)
  select user_id, 'Eating Out', monthly_limit, flow_type
  from public.budget_categories where category = 'Dining'
on conflict (user_id, category) do update set monthly_limit = excluded.monthly_limit;
delete from public.budget_categories where category = 'Dining';

insert into public.budget_categories (user_id, category, monthly_limit, flow_type)
  select user_id, 'Car & Gas', monthly_limit, flow_type
  from public.budget_categories where category = 'Gas & Fuel'
on conflict (user_id, category) do update set monthly_limit = excluded.monthly_limit;
delete from public.budget_categories where category = 'Gas & Fuel';

insert into public.budget_categories (user_id, category, monthly_limit, flow_type)
  select user_id, 'Rent', monthly_limit, flow_type
  from public.budget_categories where category = 'Rent & Housing'
on conflict (user_id, category) do update set monthly_limit = excluded.monthly_limit;
delete from public.budget_categories where category = 'Rent & Housing';
